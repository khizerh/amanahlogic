/**
 * Payment Reminder Logic
 *
 * Handles automated payment reminders based on organization's reminder schedule.
 * Uses configurable settings from organization_settings.billing_config.
 * Defaults: schedule [3, 7, 14] days, max 3 reminders
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { loadBillingConfig } from "./config";
import { sendPaymentReminderEmail } from "@/lib/email/send-payment-reminder";

/**
 * Calculate days between two YYYY-MM-DD date strings
 * Uses noon anchoring to avoid timezone shift issues
 */
function calculateDaysBetweenDates(fromDate: string, toDate: string): number {
  // Anchor at noon to avoid UTC midnight parsing issues
  const from = new Date(fromDate + "T12:00:00");
  const to = new Date(toDate + "T12:00:00");
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get today in organization timezone as YYYY-MM-DD
 */
function getTodayInOrgTimezone(timezone: string): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: timezone });
}


export interface ReminderProcessingResult {
  success: boolean;
  remindersQueued: number;
  paymentsMarkedForReview: number;
  errors: Array<{ paymentId: string; error: string }>;
}

interface PaymentForReminder {
  id: string;
  membership_id: string;
  organization_id: string;
  member_id: string;
  amount: number;
  due_date: string;
  period_label: string;
  invoice_number: string;
  reminder_count: number;
  reminder_sent_at: string | null;
  reminders_paused: boolean;
  requires_review: boolean;
  status: string;
  payment_source: string;
}

interface OrganizationSettings {
  send_invoice_reminders: boolean;
  reminder_schedule: number[];
  timezone: string;
  country: string;
}

/**
 * Check if a payment is due for a reminder based on the schedule
 */
function isReminderDue(
  payment: PaymentForReminder,
  schedule: number[],
  maxReminders: number,
  today: string
): boolean {
  const reminderCount = payment.reminder_count || 0;

  // Already at max reminders
  if (reminderCount >= maxReminders) {
    return false;
  }

  // Get the threshold for the next reminder
  const nextReminderDay = schedule[reminderCount];
  if (nextReminderDay === undefined) {
    return false;
  }

  // Calculate days since due date (using noon-anchored calculation)
  const daysSinceDue = calculateDaysBetweenDates(payment.due_date, today);

  // Check if we've reached the threshold for this reminder (>= for day-3 to fire on day 3)
  if (daysSinceDue < nextReminderDay) {
    return false;
  }

  // DOUBLE-QUEUE GUARD: Check if reminder was sent recently (within same day)
  // This prevents duplicate emails if cron runs multiple times or retries
  if (payment.reminder_sent_at) {
    const reminderDate = payment.reminder_sent_at.split("T")[0];
    const daysSinceLastReminder = calculateDaysBetweenDates(reminderDate, today);

    // Require at least 1 day between ANY reminders (even first → second)
    if (daysSinceLastReminder < 1) {
      return false;
    }

    // Extra check: For subsequent reminders, verify we're at the right schedule point
    // e.g., if schedule is [3,7,14] and we're at reminderCount=1, we should be at day 7+
    if (reminderCount > 0) {
      const expectedDay = schedule[reminderCount];
      if (expectedDay !== undefined && daysSinceDue < expectedDay) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Process reminders for a single organization
 */
export async function processOrganizationReminders(
  organizationId: string,
  supabase: SupabaseClient
): Promise<ReminderProcessingResult> {
  const result: ReminderProcessingResult = {
    success: true,
    remindersQueued: 0,
    paymentsMarkedForReview: 0,
    errors: [],
  };

  try {
    // 1. Get organization settings
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("timezone, country")
      .eq("id", organizationId)
      .single();

    if (orgError || !orgData) {
      throw new Error(`Failed to get organization: ${orgError?.message}`);
    }

    // Load billing config for reminder settings
    const billingConfig = await loadBillingConfig(organizationId, supabase);

    const settings: OrganizationSettings = {
      send_invoice_reminders: billingConfig.sendInvoiceReminders,
      reminder_schedule: billingConfig.reminderSchedule,
      timezone: orgData.timezone || "America/Los_Angeles",
      country: orgData.country || "US",
    };

    // 2. Check if reminders are enabled
    if (!settings.send_invoice_reminders) {
      logger.info("Reminders disabled for organization", { organizationId });
      return result;
    }

    // 3. Get today in org timezone
    const today = getTodayInOrgTimezone(settings.timezone);

    // 4. Get overdue payments that might need reminders
    // Only get payments that are past the first reminder threshold
    const minDaysOverdue = settings.reminder_schedule[0] || 3;
    const thresholdDate = getTodayInOrgTimezone(settings.timezone);

    // Calculate threshold date (minDaysOverdue days ago)
    const threshold = new Date(thresholdDate + "T12:00:00");
    threshold.setDate(threshold.getDate() - minDaysOverdue);
    const thresholdDateStr = threshold.toISOString().split("T")[0];

    // Query payments that might need reminders
    // NOTE: Multiple .or() calls overwrite each other in Supabase, so we:
    // 1. Use simple filters for AND conditions
    // 2. Handle NULL boolean fields in application code (null = false)
    // 3. Handle NULL reminder_count as 0 in application code
    const { data: rawPayments, error: paymentsError } = await supabase
      .from("payments")
      .select(
        `
        id,
        membership_id,
        organization_id,
        member_id,
        amount,
        due_date,
        period_label,
        invoice_number,
        reminder_count,
        reminder_sent_at,
        reminders_paused,
        requires_review,
        status,
        payment_source
      `
      )
      .eq("organization_id", organizationId)
      .in("status", ["pending", "failed"])
      .lte("due_date", thresholdDateStr);

    // Apply filters that can't be done cleanly in Supabase query
    // (multiple .or() calls overwrite each other, so we filter in JS)
    const payments = (rawPayments || []).filter((payment) => {
      // Skip if reminders are paused (null = not paused)
      if (payment.reminders_paused === true) return false;
      // Skip if requires review (null = doesn't require review)
      if (payment.requires_review === true) return false;
      // Skip if max reminders already sent (null = 0)
      if ((payment.reminder_count || 0) >= billingConfig.maxReminders) return false;
      return true;
    });

    if (paymentsError) {
      throw new Error(`Failed to query payments: ${paymentsError.message}`);
    }

    if (!payments || payments.length === 0) {
      logger.info("No payments need reminders", { organizationId });
      return result;
    }

    logger.info("Found payments for reminder check", {
      organizationId,
      count: payments.length,
    });

    // 5. Process each payment
    for (const payment of payments) {
      try {
        // Check if this payment is due for a reminder
        if (!isReminderDue(payment, settings.reminder_schedule, billingConfig.maxReminders, today)) {
          continue;
        }

        const newReminderCount = (payment.reminder_count || 0) + 1;

        // Calculate days overdue (using noon-anchored calculation)
        const daysOverdue = calculateDaysBetweenDates(payment.due_date, today);

        // Send the reminder email
        try {
          const { data: member } = await supabase
            .from("members")
            .select("id, email, first_name, last_name, preferred_language")
            .eq("id", payment.member_id)
            .single();

          if (member?.email) {
            const emailResult = await sendPaymentReminderEmail({
              to: member.email,
              memberName: `${member.first_name} ${member.last_name}`,
              memberId: member.id,
              organizationId,
              amount: payment.amount.toFixed(2),
              dueDate: payment.due_date,
              daysOverdue,
              reminderNumber: newReminderCount,
              invoiceNumber: payment.invoice_number || "N/A",
              language: (member.preferred_language as "en" | "fa") || "en",
            });

            if (!emailResult.success) {
              logger.warn("Failed to send reminder email", {
                paymentId: payment.id,
                error: emailResult.error,
              });
            }
          } else {
            logger.warn("No email address for member, skipping reminder email", {
              paymentId: payment.id,
              memberId: payment.member_id,
            });
          }
        } catch (emailErr) {
          logger.error("Error sending reminder email", {
            paymentId: payment.id,
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
        }

        // Update payment with new reminder count
        const updateData: Record<string, unknown> = {
          reminder_count: newReminderCount,
          reminder_sent_at: new Date().toISOString(),
        };

        // Mark for review if this was the last reminder
        if (newReminderCount >= billingConfig.maxReminders) {
          updateData.requires_review = true;
          result.paymentsMarkedForReview++;
        }

        await supabase.from("payments").update(updateData).eq("id", payment.id);

        result.remindersQueued++;

        logger.info("Queued payment reminder", {
          paymentId: payment.id,
          reminderCount: newReminderCount,
          daysOverdue,
        });
      } catch (paymentError) {
        const errorMessage = paymentError instanceof Error ? paymentError.message : String(paymentError);
        result.errors.push({
          paymentId: payment.id,
          error: errorMessage,
        });
        logger.error("Failed to process payment reminder", {
          paymentId: payment.id,
          error: errorMessage,
        });
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to process organization reminders", {
      organizationId,
      error: errorMessage,
    });
    result.success = false;
    result.errors.push({ paymentId: "organization", error: errorMessage });
    return result;
  }
}

/**
 * Send a single reminder for a specific payment (manual trigger)
 */
export async function sendPaymentReminder(
  paymentId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(
        `
        id,
        membership_id,
        organization_id,
        member_id,
        amount,
        due_date,
        period_label,
        invoice_number,
        reminder_count,
        status,
        payment_source
      `
      )
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return { success: false, error: "Payment not found" };
    }

    // Validate payment status
    if (!["pending", "failed"].includes(payment.status)) {
      return { success: false, error: "Can only send reminders for pending or failed payments" };
    }

    // Get organization settings and billing config
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone, country")
      .eq("id", payment.organization_id)
      .single();

    const timezone = org?.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(timezone);

    // Load billing config for max reminders setting
    const billingConfig = await loadBillingConfig(payment.organization_id, supabase);

    // Calculate values (using noon-anchored calculation)
    const daysOverdue = calculateDaysBetweenDates(payment.due_date, today);
    const newReminderCount = (payment.reminder_count || 0) + 1;

    // Send the reminder email
    try {
      const { data: member } = await supabase
        .from("members")
        .select("id, email, first_name, last_name, preferred_language")
        .eq("id", payment.member_id)
        .single();

      if (member?.email) {
        const emailResult = await sendPaymentReminderEmail({
          to: member.email,
          memberName: `${member.first_name} ${member.last_name}`,
          memberId: member.id,
          organizationId: payment.organization_id,
          amount: payment.amount.toFixed(2),
          dueDate: payment.due_date,
          daysOverdue: Math.max(daysOverdue, 0),
          reminderNumber: Math.min(newReminderCount, billingConfig.maxReminders),
          invoiceNumber: payment.invoice_number || "N/A",
          language: (member.preferred_language as "en" | "fa") || "en",
        });

        if (!emailResult.success) {
          logger.warn("Failed to send manual reminder email", {
            paymentId: payment.id,
            error: emailResult.error,
          });
        }
      } else {
        logger.warn("No email address for member, skipping reminder email", {
          paymentId: payment.id,
          memberId: payment.member_id,
        });
      }
    } catch (emailErr) {
      logger.error("Error sending manual reminder email", {
        paymentId: payment.id,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    // Update payment
    const updateData: Record<string, unknown> = {
      reminder_count: newReminderCount,
      reminder_sent_at: new Date().toISOString(),
    };

    if (newReminderCount >= billingConfig.maxReminders) {
      updateData.requires_review = true;
    }

    await supabase.from("payments").update(updateData).eq("id", paymentId);

    logger.info("Manual reminder sent", {
      paymentId,
      reminderCount: newReminderCount,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to send manual reminder", { paymentId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
