/**
 * Recurring Billing Engine for Burial Benefits
 *
 * Core billing engine that processes recurring memberships and generates payments.
 * Designed to be called by cron jobs or manually triggered by admins.
 *
 * Key adaptations for burial benefits:
 * - Process memberships where next_payment_due <= today
 * - Skip Stripe-managed subscriptions (they handle their own billing)
 * - For manual billing: create pending payment record
 * - Track paidMonths: monthly = +1, biannual = +6, annual = +12
 * - Status transitions:
 *   - If paidMonths >= 60 and status is waiting_period → change to active
 *   - If payment overdue > 7 days and status is active/waiting_period → change to lapsed
 *   - If unpaid for 24 months → change to cancelled
 * - Use organization timezone for date calculations
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logger } from "./logger";
import {
  generateInvoiceNumber,
  calculateNextBillingDate,
  formatPeriodLabel,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
} from "./invoice-generator";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingFrequency,
  MembershipStatus,
  PaymentMethod,
  PaymentType,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BillingOptions {
  dryRun?: boolean;
  billingDate?: string; // YYYY-MM-DD
  debugMode?: boolean;
  skipAutoComplete?: boolean;
  supabase?: SupabaseClient;
}

export interface BillingRunResult {
  success: boolean;
  paymentsCreated: number;
  paymentIds: string[];
  skipped: number;
  statusUpdates: number;
  errors: Array<{ membership_id: string; error: string }>;
  timestamp: string;
}

interface MembershipToBill {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string;
  status: MembershipStatus;
  billing_frequency: BillingFrequency;
  billing_anniversary_day: number;
  paid_months: number;
  enrollment_fee_paid: boolean;
  join_date: string;
  last_payment_date: string | null;
  next_payment_due: string | null;
  eligible_date: string | null;
  cancelled_date: string | null;
  agreement_signed_at: string | null;
  agreement_id: string | null;
  created_at: string;
  updated_at: string;
  // Stripe subscription tracking
  stripe_subscription_id?: string | null;
  stripe_subscription_status?: string | null;
  // Joined data
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  plan?: {
    name: string;
    type: string;
    pricing: {
      monthly: number;
      biannual: number;
      annual: number;
    };
  };
}

// -----------------------------------------------------------------------------
// Main Billing Functions
// -----------------------------------------------------------------------------

/**
 * Process recurring billing for all active organizations
 *
 * Top-level orchestrator that processes all active organizations in the system.
 * Called by cron job to auto-generate payments daily.
 *
 * @param options - Billing options (dryRun, billingDate, debugMode)
 * @returns Dictionary of results by organization_id
 *
 * @example
 * // Process all organizations for today
 * const results = await processAllOrganizationsBilling();
 *
 * // Dry run for testing
 * const results = await processAllOrganizationsBilling({ dryRun: true });
 *
 * // Test with future date
 * const results = await processAllOrganizationsBilling({
 *   billingDate: '2025-02-01'
 * });
 */
export async function processAllOrganizationsBilling(
  options: BillingOptions = {}
): Promise<Record<string, BillingRunResult>> {
  const supabase = options.supabase || (await createClient());

  logger.info("billing_run_started_all_organizations", {
    dryRun: options.dryRun,
    billingDate: options.billingDate,
    debugMode: options.debugMode,
    timestamp: new Date().toISOString(),
  });

  // Query all active organizations
  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("active", true);

  if (organizationsError || !organizations) {
    logger.error("failed_to_query_organizations", {
      error: organizationsError?.message,
    });
    throw new Error(`Failed to query organizations: ${organizationsError?.message}`);
  }

  logger.info("organizations_found", { count: organizations.length });

  const results: Record<string, BillingRunResult> = {};

  // Process each organization (continue on error)
  for (const organization of organizations) {
    try {
      logger.info("processing_organization", {
        organization_id: organization.id,
        name: organization.name,
      });

      const result = await processRecurringBilling(organization.id, options);
      results[organization.id] = result;

      logger.info("organization_completed", {
        organization_id: organization.id,
        payments_created: result.paymentsCreated,
        status_updates: result.statusUpdates,
        skipped: result.skipped,
        errors: result.errors.length,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error("organization_billing_failed", {
        organization_id: organization.id,
        name: organization.name,
        error: errorMessage,
        stack: options.debugMode ? errorStack : undefined,
      });

      // Record failure but continue with other organizations
      results[organization.id] = {
        success: false,
        paymentsCreated: 0,
        paymentIds: [],
        skipped: 0,
        statusUpdates: 0,
        errors: [{ membership_id: "N/A", error: errorMessage }],
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Log final summary
  const totalPayments = Object.values(results).reduce((sum, r) => sum + r.paymentsCreated, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
  const totalStatusUpdates = Object.values(results).reduce(
    (sum, r) => sum + r.statusUpdates,
    0
  );
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

  logger.info("billing_run_complete_all_organizations", {
    organizations_processed: organizations.length,
    total_payments: totalPayments,
    total_status_updates: totalStatusUpdates,
    total_skipped: totalSkipped,
    total_errors: totalErrors,
  });

  return results;
}

/**
 * Process recurring billing for a single organization
 *
 * Main billing logic that processes all active memberships for one organization.
 * Can be called by cron (via processAllOrganizationsBilling) or manually by admins.
 *
 * @param organization_id - ID of the organization to process
 * @param options - Billing options (dryRun, billingDate, debugMode)
 * @returns Billing run result with counts and errors
 *
 * @example
 * // Process specific organization
 * const result = await processRecurringBilling('org-123');
 *
 * // Dry run for testing
 * const result = await processRecurringBilling('org-123', {
 *   dryRun: true,
 *   debugMode: true
 * });
 */
export async function processRecurringBilling(
  organization_id: string,
  options: BillingOptions = {}
): Promise<BillingRunResult> {
  const supabase = options.supabase || (await createClient());

  // Step 1: Get organization timezone FIRST (needed for all date calculations)
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organization_id)
    .single();

  if (orgError || !org) {
    logger.error("failed_to_get_organization", {
      organization_id,
      error: orgError?.message,
    });
    return {
      success: false,
      paymentsCreated: 0,
      paymentIds: [],
      skipped: 0,
      statusUpdates: 0,
      errors: [
        {
          membership_id: "N/A",
          error: `Failed to get organization: ${orgError?.message}`,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  const orgTimezone = org.timezone || "America/Los_Angeles";

  // Step 2: Acquire advisory lock to prevent concurrent billing runs
  if (!options.dryRun) {
    const { data: lockAcquired, error: lockError } = await supabase.rpc("acquire_billing_lock", {
      p_organization_id: organization_id,
    });

    if (lockError) {
      logger.error("failed_to_acquire_lock", {
        organization_id,
        error: lockError.message,
      });
      return {
        success: false,
        paymentsCreated: 0,
        paymentIds: [],
        skipped: 0,
        statusUpdates: 0,
        errors: [
          {
            membership_id: "N/A",
            error: `Failed to acquire billing lock: ${lockError.message}`,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    if (!lockAcquired) {
      logger.warn("billing_run_already_in_progress", {
        organization_id,
        message: "Another billing process is currently running for this organization",
      });
      return {
        success: false,
        paymentsCreated: 0,
        paymentIds: [],
        skipped: 0,
        statusUpdates: 0,
        errors: [
          {
            membership_id: "N/A",
            error: "Billing run already in progress. Please wait for the current run to complete.",
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    logger.info("billing_lock_acquired", { organization_id });
  }

  // Step 3: Determine billing date in org's timezone
  const today = options.billingDate || getTodayInOrgTimezone(orgTimezone);

  logger.info("billing_run_started", {
    organization_id,
    billing_date: today,
    dryRun: options.dryRun,
    debugMode: options.debugMode,
  });

  // Initialize counters
  let paymentsCreated = 0;
  let statusUpdates = 0;
  let skipped = 0;
  const paymentIds: string[] = [];
  const errors: Array<{ membership_id: string; error: string }> = [];

  try {
    // Step 4: Query memberships due for billing
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select(
        `
        id,
        organization_id,
        member_id,
        plan_id,
        status,
        billing_frequency,
        billing_anniversary_day,
        paid_months,
        enrollment_fee_paid,
        join_date,
        last_payment_date,
        next_payment_due,
        eligible_date,
        cancelled_date,
        agreement_signed_at,
        agreement_id,
        created_at,
        updated_at,
        stripe_subscription_id,
        stripe_subscription_status,
        member:members(
          first_name,
          last_name,
          email
        ),
        plan:plans(
          name,
          type,
          pricing
        )
      `
      )
      .eq("organization_id", organization_id)
      .in("status", ["waiting_period", "active"])
      .lte("next_payment_due", today)
      .not("next_payment_due", "is", null);

    if (membershipsError) {
      throw new Error(`Failed to query memberships: ${membershipsError.message}`);
    }

    logger.info("memberships_found", {
      organization_id,
      count: memberships?.length || 0,
    });

    if (!memberships || memberships.length === 0) {
      logger.info("no_memberships_to_process", { organization_id });

      // Release lock before returning
      if (!options.dryRun) {
        await releaseBillingLock(supabase, organization_id);
      }

      return {
        success: true,
        paymentsCreated: 0,
        paymentIds: [],
        skipped: 0,
        statusUpdates: 0,
        errors: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Step 5: Process each membership
    for (const rawMembership of memberships || []) {
      // Transform Supabase response to our type (relations are arrays, take first element)
      const membership: MembershipToBill = {
        ...rawMembership,
        member: Array.isArray(rawMembership.member)
          ? rawMembership.member[0]
          : rawMembership.member,
        plan: Array.isArray(rawMembership.plan) ? rawMembership.plan[0] : rawMembership.plan,
      } as MembershipToBill;

      try {
        // Check 0: Has Stripe subscription? (Skip - Stripe handles billing)
        if (
          membership.stripe_subscription_id &&
          (membership.stripe_subscription_status === "active" ||
            membership.stripe_subscription_status === "trialing")
        ) {
          logger.info("membership_skipped", {
            membership_id: membership.id,
            reason: "stripe_subscription",
            subscription_id: membership.stripe_subscription_id,
            subscription_status: membership.stripe_subscription_status,
          });
          skipped++;
          continue;
        }

        // Check 1: Is next_payment_due valid?
        const nextPaymentDueStr = membership.next_payment_due;
        if (!nextPaymentDueStr || !/^\d{4}-\d{2}-\d{2}$/.test(nextPaymentDueStr)) {
          logger.warn("membership_skipped_invalid_payment_due", {
            membership_id: membership.id,
            next_payment_due: membership.next_payment_due,
          });
          skipped++;
          continue;
        }

        // Check 2: Payment Already Exists for Period? (Skip + Log Warning)
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id, status, created_at")
          .eq("membership_id", membership.id)
          .gte("created_at", nextPaymentDueStr)
          .in("status", ["pending", "completed"])
          .maybeSingle();

        if (existingPayment) {
          logger.warn("membership_skipped_duplicate", {
            membership_id: membership.id,
            existing_payment_id: existingPayment.id,
            existing_status: existingPayment.status,
            reason: "payment_already_exists_for_period",
          });
          skipped++;
          continue;
        }

        // Step 6: Create Payment Record
        if (options.dryRun) {
          // Dry run mode: just log what would be created
          logger.debug("dry_run_would_create_payment", {
            membership_id: membership.id,
            member_name: `${membership.member?.first_name} ${membership.member?.last_name}`,
            plan_name: membership.plan?.name,
            billing_frequency: membership.billing_frequency,
            next_payment_due: nextPaymentDueStr,
          });
          paymentsCreated++;
          continue;
        }

        // Real mode: create actual payment record
        try {
          const periodStart = parseDateInOrgTimezone(nextPaymentDueStr, orgTimezone);
          const invoiceNumber = await generateInvoiceNumber(organization_id, periodStart, supabase);

          // Calculate amount based on billing frequency
          const amount = membership.plan?.pricing?.[membership.billing_frequency] || 0;

          // Calculate months credited
          let monthsCredited: number;
          switch (membership.billing_frequency) {
            case "monthly":
              monthsCredited = 1;
              break;
            case "biannual":
              monthsCredited = 6;
              break;
            case "annual":
              monthsCredited = 12;
              break;
            default:
              monthsCredited = 1;
          }

          // Format period label
          const periodLabel = formatPeriodLabel(periodStart, membership.billing_frequency);

          // Create payment record
          const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .insert({
              organization_id: membership.organization_id,
              membership_id: membership.id,
              member_id: membership.member_id,
              type: "dues" as PaymentType,
              method: null, // Will be set when payment is made
              status: "pending",
              amount: amount,
              stripe_fee: 0,
              platform_fee: 0,
              total_charged: amount,
              net_amount: amount,
              months_credited: monthsCredited,
              stripe_payment_intent_id: null,
              notes: `${periodLabel} dues`,
              recorded_by: null,
              paid_at: null,
              refunded_at: null,
            })
            .select()
            .single();

          if (paymentError) {
            throw paymentError;
          }

          logger.info("payment_created", {
            membership_id: membership.id,
            payment_id: payment.id,
            invoice_number: invoiceNumber,
            amount: amount,
            months_credited: monthsCredited,
            period_label: periodLabel,
          });

          paymentsCreated++;
          paymentIds.push(payment.id);

          // Step 7: Update membership
          const newPaidMonths = membership.paid_months + monthsCredited;
          const nextBillingDate = calculateNextBillingDate(
            periodStart,
            membership.billing_frequency,
            orgTimezone
          );
          const nextBillingDateStr = nextBillingDate.toISOString().split("T")[0];

          // Determine new status
          let newStatus: MembershipStatus = membership.status;
          if (membership.status === "waiting_period" && newPaidMonths >= 60) {
            newStatus = "active";
            logger.info("membership_status_transition", {
              membership_id: membership.id,
              old_status: "waiting_period",
              new_status: "active",
              paid_months: newPaidMonths,
              reason: "reached_60_paid_months",
            });
            statusUpdates++;
          }

          const { error: updateError } = await supabase
            .from("memberships")
            .update({
              paid_months: newPaidMonths,
              next_payment_due: nextBillingDateStr,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", membership.id);

          if (updateError) {
            logger.warn("failed_to_update_membership", {
              membership_id: membership.id,
              error: updateError.message,
            });
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === "object" && error !== null && "message" in error
                ? String((error as { message: unknown }).message)
                : JSON.stringify(error);

          logger.error("payment_creation_failed", {
            membership_id: membership.id,
            member_name: membership.member
              ? `${membership.member.first_name} ${membership.member.last_name}`
              : "Unknown",
            error: errorMessage,
            errorDetails: error,
            stack: options.debugMode && error instanceof Error ? error.stack : undefined,
          });

          errors.push({
            membership_id: membership.id,
            error: errorMessage,
          });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : JSON.stringify(error);

        logger.error("membership_processing_failed", {
          membership_id: membership.id,
          error: errorMessage,
          errorDetails: error,
          stack: options.debugMode && error instanceof Error ? error.stack : undefined,
        });

        errors.push({
          membership_id: membership.id,
          error: errorMessage,
        });
      }
    }

    // Step 8: Process status transitions for lapsed/cancelled memberships
    if (!options.dryRun) {
      const statusTransitionResult = await processStatusTransitions(
        organization_id,
        today,
        orgTimezone,
        supabase
      );
      statusUpdates += statusTransitionResult.updates;
    }
  } catch (error: unknown) {
    logger.error("billing_run_failed", {
      organization_id,
      error: error instanceof Error ? error.message : String(error),
      stack: options.debugMode && error instanceof Error ? error.stack : undefined,
    });

    // Release lock before returning
    if (!options.dryRun) {
      await releaseBillingLock(supabase, organization_id);
    }

    return {
      success: false,
      paymentsCreated: 0,
      paymentIds: [],
      skipped: 0,
      statusUpdates: 0,
      errors: [
        { membership_id: "N/A", error: error instanceof Error ? error.message : String(error) },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Step 9: Return result
  const result: BillingRunResult = {
    success: errors.length === 0,
    paymentsCreated,
    paymentIds,
    skipped,
    statusUpdates,
    errors,
    timestamp: new Date().toISOString(),
  };

  logger.info("billing_run_complete", {
    organization_id,
    summary: {
      payments_created: result.paymentsCreated,
      status_updates: result.statusUpdates,
      skipped: result.skipped,
      errors: result.errors.length,
    },
  });

  // Step 10: Release advisory lock
  if (!options.dryRun) {
    await releaseBillingLock(supabase, organization_id);
  }

  return result;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Process status transitions for lapsed/cancelled memberships
 *
 * - If payment overdue > 7 days and status is active/waiting_period → change to lapsed
 * - If unpaid for 24 months → change to cancelled
 */
async function processStatusTransitions(
  organization_id: string,
  today: string,
  orgTimezone: string,
  supabase: SupabaseClient
): Promise<{ updates: number }> {
  let updates = 0;

  // Calculate cutoff dates
  const todayDate = parseDateInOrgTimezone(today, orgTimezone);
  const sevenDaysAgo = new Date(todayDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const twentyFourMonthsAgo = new Date(todayDate);
  twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
  const twentyFourMonthsAgoStr = twentyFourMonthsAgo.toISOString().split("T")[0];

  // Find memberships to lapse (payment overdue > 7 days)
  const { data: toLapse, error: toLapseError } = await supabase
    .from("memberships")
    .select("id, member_id, next_payment_due")
    .eq("organization_id", organization_id)
    .in("status", ["active", "waiting_period"])
    .lte("next_payment_due", sevenDaysAgoStr);

  if (!toLapseError && toLapse && toLapse.length > 0) {
    for (const membership of toLapse) {
      const { error: updateError } = await supabase
        .from("memberships")
        .update({
          status: "lapsed" as MembershipStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);

      if (!updateError) {
        logger.info("membership_status_transition", {
          membership_id: membership.id,
          old_status: "active/waiting_period",
          new_status: "lapsed",
          reason: "payment_overdue_7_days",
          next_payment_due: membership.next_payment_due,
        });
        updates++;
      } else {
        logger.error("failed_to_update_status_to_lapsed", {
          membership_id: membership.id,
          error: updateError.message,
        });
      }
    }
  }

  // Find memberships to cancel (unpaid for 24 months)
  const { data: toCancel, error: toCancelError } = await supabase
    .from("memberships")
    .select("id, member_id, last_payment_date")
    .eq("organization_id", organization_id)
    .in("status", ["lapsed"])
    .or(`last_payment_date.lte.${twentyFourMonthsAgoStr},last_payment_date.is.null`);

  if (!toCancelError && toCancel && toCancel.length > 0) {
    for (const membership of toCancel) {
      const { error: updateError } = await supabase
        .from("memberships")
        .update({
          status: "cancelled" as MembershipStatus,
          cancelled_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);

      if (!updateError) {
        logger.info("membership_status_transition", {
          membership_id: membership.id,
          old_status: "lapsed",
          new_status: "cancelled",
          reason: "unpaid_24_months",
          last_payment_date: membership.last_payment_date,
        });
        updates++;
      } else {
        logger.error("failed_to_update_status_to_cancelled", {
          membership_id: membership.id,
          error: updateError.message,
        });
      }
    }
  }

  return { updates };
}

/**
 * Release billing lock
 */
async function releaseBillingLock(supabase: SupabaseClient, organization_id: string) {
  try {
    const { error: unlockError } = await supabase.rpc("release_billing_lock", {
      p_organization_id: organization_id,
    });

    if (unlockError) {
      logger.error("failed_to_release_lock", {
        organization_id,
        error: unlockError.message,
        severity: "critical",
        action_required: "Manual intervention may be needed if billing gets stuck",
      });
    } else {
      logger.info("billing_lock_released", { organization_id });
    }
  } catch (unlockError: unknown) {
    logger.error("exception_releasing_lock", {
      organization_id,
      error: unlockError instanceof Error ? unlockError.message : String(unlockError),
      severity: "critical",
      action_required: "Manual intervention may be needed if billing gets stuck",
    });
  }
}
