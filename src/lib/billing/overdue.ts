/**
 * Overdue follow-up
 *
 * Daily job for members nobody else is chasing. Stripe handles dunning for
 * members with a live subscription; everyone else (cash/check/Zelle payers and
 * members whose subscription Stripe cancelled after exhausting retries) just
 * sits at status=current with a stale next_payment_due. This module:
 *
 * 1. Sends overdue reminder emails on the org's reminderSchedule
 * 2. Moves members past lapseDays to `lapsed` — ONLY when billing_config.autoLapse
 *    is on. Off by default; the digest lists who would lapse instead.
 * 3. Builds the admin digest of who is overdue and what changed
 *
 * Reminder state is derived from email_logs (payment_reminder rows since the
 * due date), so there is no pending-invoice row to keep in sync.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";
import { loadBillingConfig } from "./config";
import { getTodayInOrgTimezone } from "./invoice-generator";
import { sendPaymentReminderEmail } from "@/lib/email/send-payment-reminder";
import type { BillingFrequency } from "@/lib/types";

// Past this, a reminder email is the wrong tool — the digest flags them for a call.
const MAX_REMINDER_DAYS_OVERDUE = 60;
// Never send two reminders closer together than this, even when catching up.
const MIN_DAYS_BETWEEN_REMINDERS = 3;

// Stripe is still collecting for these — leave dunning to Stripe + the payment_failed email.
const STRIPE_COLLECTING = ["active", "trialing", "past_due"];

export interface OverdueMember {
  membershipId: string;
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  language: "en" | "fa";
  nextPaymentDue: string;
  daysOverdue: number;
  billingFrequency: BillingFrequency;
  amountDue: number;
  paidMonths: number;
  status: string;
  /** Live Stripe subscription — paying, but behind on back dues */
  onAutoPay: boolean;
  /** Subscription was cancelled (by Stripe after failed retries, or by an admin) */
  subscriptionDied: boolean;
}

export interface OverdueRunResult {
  organizationId: string;
  today: string;
  overdue: OverdueMember[];
  remindersSent: Array<{ member: OverdueMember; reminderNumber: number }>;
  reminderErrors: Array<{ membershipId: string; error: string }>;
  lapsed: OverdueMember[];
  wouldLapse: OverdueMember[];
  autoLapse: boolean;
  lapseDays: number;
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = Date.parse(`${fromDateStr}T00:00:00Z`);
  const to = Date.parse(`${toDateStr}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000);
}

/**
 * Every onboarded membership whose next_payment_due has passed.
 */
export async function getOverdueMembers(
  organizationId: string,
  today: string,
  supabase: SupabaseClient
): Promise<OverdueMember[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      `
      id,
      member_id,
      status,
      billing_frequency,
      next_payment_due,
      paid_months,
      stripe_subscription_id,
      subscription_status,
      member:members!memberships_member_id_fkey(
        first_name,
        middle_name,
        last_name,
        email,
        phone,
        preferred_language
      ),
      plan:plans(pricing)
    `
    )
    .eq("organization_id", organizationId)
    .in("status", ["current", "lapsed"])
    .neq("enrollment_fee_status", "unpaid")
    .not("agreement_signed_at", "is", null)
    .not("next_payment_due", "is", null)
    .lt("next_payment_due", today)
    .order("next_payment_due", { ascending: true });

  if (error) {
    throw new Error(`Failed to query overdue memberships: ${error.message}`);
  }

  return (data || []).map((row) => {
    const member = Array.isArray(row.member) ? row.member[0] : row.member;
    const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
    const frequency = (row.billing_frequency || "monthly") as BillingFrequency;
    const pricing = (plan?.pricing || {}) as Partial<Record<BillingFrequency, number>>;
    const onAutoPay =
      !!row.stripe_subscription_id && STRIPE_COLLECTING.includes(row.subscription_status || "");

    return {
      membershipId: row.id,
      memberId: row.member_id,
      name: [member?.first_name, member?.middle_name, member?.last_name].filter(Boolean).join(" "),
      email: member?.email || null,
      phone: member?.phone || null,
      language: member?.preferred_language === "fa" ? "fa" : "en",
      nextPaymentDue: row.next_payment_due,
      daysOverdue: daysBetween(row.next_payment_due, today),
      billingFrequency: frequency,
      amountDue: pricing[frequency] || 0,
      paidMonths: row.paid_months || 0,
      status: row.status,
      onAutoPay,
      subscriptionDied: !onAutoPay && row.subscription_status === "canceled",
    };
  });
}

/**
 * Run reminders + lapse transitions for one organization.
 */
export async function processOverdueFollowUp(
  organizationId: string,
  supabase: SupabaseClient,
  options: { dryRun?: boolean; today?: string } = {}
): Promise<OverdueRunResult> {
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();
  const today = options.today || getTodayInOrgTimezone(org?.timezone || "America/Los_Angeles");

  const config = await loadBillingConfig(organizationId, supabase);
  const overdue = await getOverdueMembers(organizationId, today, supabase);

  const result: OverdueRunResult = {
    organizationId,
    today,
    overdue,
    remindersSent: [],
    reminderErrors: [],
    lapsed: [],
    wouldLapse: [],
    autoLapse: config.autoLapse,
    lapseDays: config.lapseDays,
  };

  // Members on a live subscription are Stripe's to chase; they only show up in the digest.
  const unchased = overdue.filter((m) => !m.onAutoPay);

  // --- Reminders ---
  if (config.sendInvoiceReminders) {
    const schedule = [...config.reminderSchedule].sort((a, b) => a - b);
    const maxReminders = Math.min(config.maxReminders, schedule.length);

    for (const member of unchased) {
      if (!member.email || member.amountDue <= 0) continue;
      if (member.daysOverdue > MAX_REMINDER_DAYS_OVERDUE) continue;

      try {
        const { data: sent, error: logError } = await supabase
          .from("email_logs")
          .select("created_at")
          .eq("organization_id", organizationId)
          .eq("member_id", member.memberId)
          .eq("template_type", "payment_reminder")
          .neq("status", "failed")
          .gte("created_at", `${member.nextPaymentDue}T00:00:00Z`)
          .order("created_at", { ascending: false });
        if (logError) throw new Error(logError.message);

        const sentCount = sent?.length || 0;
        if (sentCount >= maxReminders) continue;
        if (member.daysOverdue < schedule[sentCount]) continue;

        const lastSentAt = sent?.[0]?.created_at;
        if (lastSentAt) {
          const daysSinceLast = (Date.now() - Date.parse(lastSentAt)) / 86_400_000;
          if (daysSinceLast < MIN_DAYS_BETWEEN_REMINDERS) continue;
        }

        const reminderNumber = sentCount + 1;
        if (!options.dryRun) {
          const send = await sendPaymentReminderEmail({
            to: member.email,
            memberName: member.name,
            memberId: member.memberId,
            organizationId,
            amount: member.amountDue.toFixed(2),
            dueDate: member.nextPaymentDue,
            daysOverdue: member.daysOverdue,
            reminderNumber,
            language: member.language,
          });
          if (!send.success) throw new Error(send.error || "send failed");
        }

        result.remindersSent.push({ member, reminderNumber });
        logger.info("overdue_reminder_sent", {
          membership_id: member.membershipId,
          reminder_number: reminderNumber,
          days_overdue: member.daysOverdue,
          dryRun: options.dryRun,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.reminderErrors.push({ membershipId: member.membershipId, error: message });
        logger.error("overdue_reminder_failed", {
          membership_id: member.membershipId,
          error: message,
        });
      }
    }
  }

  // --- Lapse transitions ---
  const lapseCandidates = unchased.filter(
    (m) => m.status === "current" && m.daysOverdue > config.lapseDays
  );

  if (!config.autoLapse) {
    result.wouldLapse = lapseCandidates;
  } else {
    for (const member of lapseCandidates) {
      if (options.dryRun) {
        result.lapsed.push(member);
        continue;
      }
      const { error } = await supabase
        .from("memberships")
        .update({ status: "lapsed", updated_at: new Date().toISOString() })
        .eq("id", member.membershipId)
        .eq("status", "current");

      if (error) {
        logger.error("failed_to_update_status_to_lapsed", {
          membership_id: member.membershipId,
          error: error.message,
        });
        continue;
      }
      result.lapsed.push(member);
      logger.info("membership_status_transition", {
        membership_id: member.membershipId,
        old_status: "current",
        new_status: "lapsed",
        reason: `payment_overdue_${config.lapseDays}_days`,
        next_payment_due: member.nextPaymentDue,
      });
    }
  }

  return result;
}
