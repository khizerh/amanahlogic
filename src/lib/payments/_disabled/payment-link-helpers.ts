/**
 * Payment link helper functions
 * @module lib/payments/payment-link-helpers
 */

import "server-only";

import { logger } from "@/lib/logger";
import { PaymentsService } from "@/lib/database/payments";
import { StripeCheckoutInvitesService } from "@/lib/database/stripe-checkout-invites";
import { calculateNextBillingDate } from "@/lib/billing/invoice-generator";
import {
  calculateCatchupCharges,
  validateBackdatingAllowed,
} from "@/lib/billing/catchup-calculator";
import { cleanFamilyNameForDisplay } from "@/lib/email/context";
import { queueEmail } from "@/lib/email/queue";
import { getTodayInOrgTimezone, parseDateInOrgTimezone } from "@/lib/utils/timezone";
import type {
  StudentData,
  FamilyData,
  ProgramData,
  OrganizationData,
  CatchupLineItem,
  BillingFrequency,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enrollment data type from Supabase query
 */
export interface EnrollmentQueryResult {
  id: string;
  organization_id: string;
  enrolled_date?: string | null;
  billing_anchor_date?: string | null;
  base_tuition: number;
  discount_amount?: number | null;
  discount_type?: string | null;
  final_tuition: number;
  next_billing_date?: string | null;
  billing_method?: string | null;
  student: unknown;
  family: unknown;
  program: unknown;
  organization: unknown;
}

/**
 * Extract nested data that may be array or object from Supabase joins
 */
export function extractNested<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] as T;
  return raw as T;
}

/**
 * Calculate billing parameters for recurring programs
 */
export function calculateRecurringBillingParams({
  enrollment,
  program,
  orgTimezone,
}: {
  enrollment: EnrollmentQueryResult;
  program: ProgramData;
  orgTimezone: string;
}): {
  success: boolean;
  error?: string;
  nextBillingDate?: Date;
  catchupCharges?: CatchupLineItem[];
  trialEnd?: number;
} {
  const today = getTodayInOrgTimezone(orgTimezone);
  let nextBillingDate: Date;

  if (enrollment.next_billing_date) {
    if (enrollment.next_billing_date <= today) {
      const currentBillingDate = parseDateInOrgTimezone(enrollment.next_billing_date, orgTimezone);
      nextBillingDate = calculateNextBillingDate(
        currentBillingDate,
        (program.payment_frequency || "monthly") as BillingFrequency,
        orgTimezone
      );
    } else {
      nextBillingDate = parseDateInOrgTimezone(enrollment.next_billing_date, orgTimezone);
    }
  } else {
    nextBillingDate = calculateNextBillingDate(
      new Date(),
      (program.payment_frequency || "monthly") as BillingFrequency,
      orgTimezone
    );
  }

  let catchupCharges: CatchupLineItem[] | undefined;
  let trialEnd: number | undefined;

  if (enrollment.billing_anchor_date) {
    const billingAnchorDate = parseDateInOrgTimezone(enrollment.billing_anchor_date, orgTimezone);
    const isBackdated = enrollment.billing_anchor_date < today;

    if (isBackdated) {
      try {
        validateBackdatingAllowed(program.payment_frequency || "");
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : `Backdating is only allowed for monthly programs. This ${program.payment_frequency} program cannot be backdated.`,
        };
      }

      // Only monthly gets catch-up charges
      if (program.payment_frequency === "monthly") {
        const catchupCalculation = calculateCatchupCharges(
          billingAnchorDate,
          nextBillingDate,
          enrollment.final_tuition,
          orgTimezone
        );

        if (catchupCalculation.lineItems.length > 0) {
          catchupCharges = catchupCalculation.lineItems.map((item) => ({
            description: item.description,
            amount: item.amount,
            period_start: item.period_start,
            period_end: item.period_end,
          }));

          trialEnd = Math.floor(nextBillingDate.getTime() / 1000);

          logger.info(
            "Backdated enrollment detected - adding catch-up charges",
            {
              enrollment_id: enrollment.id,
              billing_anchor_date: enrollment.billing_anchor_date,
              next_billing_date: enrollment.next_billing_date,
              catchup_summary: catchupCalculation.summary,
              catchup_amount: catchupCalculation.totalAmount / 100,
            },
            "payments"
          );
        }
      }
    } else {
      trialEnd = Math.floor(nextBillingDate.getTime() / 1000);
    }
  } else {
    trialEnd = Math.floor(nextBillingDate.getTime() / 1000);
  }

  return {
    success: true,
    nextBillingDate,
    catchupCharges,
    trialEnd,
  };
}

/**
 * Log checkout invite for tracking
 */
export async function logCheckoutInvite({
  enrollment,
  student,
  program,
  customerId,
  checkoutSession,
  subscriptionTrialEnd,
  organization_id,
  organization,
  orgTimezone,
  supabase,
}: {
  enrollment: EnrollmentQueryResult;
  student: StudentData;
  program: ProgramData;
  customerId: string;
  checkoutSession: { id: string; url: string | null; metadata?: Record<string, string> | null };
  subscriptionTrialEnd?: number;
  organization_id: string;
  organization: OrganizationData | null;
  orgTimezone: string;
  supabase: SupabaseClient;
}): Promise<void> {
  try {
    const billingPeriodStart = enrollment.next_billing_date || getTodayInOrgTimezone(orgTimezone);

    let stripeChargeDate = new Date();
    if (subscriptionTrialEnd) {
      stripeChargeDate = new Date(subscriptionTrialEnd * 1000);
    } else {
      stripeChargeDate.setDate(stripeChargeDate.getDate() + 7);
    }

    await StripeCheckoutInvitesService.cancelPendingForEnrollment(enrollment.id, supabase);
    await StripeCheckoutInvitesService.create(
      {
        organization_id,
        enrollment_id: enrollment.id,
        student_id: student.id,
        family_id: student.family_id,
        program_id: program.id,
        stripe_customer_api_id: customerId,
        stripe_checkout_session_id: checkoutSession.id,
        planned_amount: enrollment.final_tuition,
        planned_currency: organization?.currency || "USD",
        stripe_coupon_id: checkoutSession.metadata?.stripe_coupon_id || null,
        first_charge_date: billingPeriodStart,
        notes: subscriptionTrialEnd
          ? `Onboarding checkout generated. Billing period: ${billingPeriodStart}, Stripe trial ends: ${stripeChargeDate.toISOString().split("T")[0]}`
          : "Onboarding checkout generated.",
      },
      supabase
    );
    logger.info(
      "Recorded Stripe checkout invite",
      { enrollmentId: enrollment.id, sessionId: checkoutSession.id },
      "payments"
    );
  } catch (inviteError) {
    logger.error(
      "Failed to record checkout invite",
      {
        error: inviteError instanceof Error ? inviteError.message : String(inviteError),
        enrollmentId: enrollment.id,
      },
      "payments"
    );
  }
}

/**
 * Queue payment link confirmation email
 */
export async function queuePaymentLinkEmail({
  enrollment,
  student,
  family,
  program,
  recipient,
  checkoutSession,
  firstChargeDateStr,
  hasActiveSubscription,
  organization_id,
  org_slug,
}: {
  enrollment: EnrollmentQueryResult;
  student: StudentData;
  family: FamilyData;
  program: ProgramData;
  recipient: { email: string; name: string | null; isStudent: boolean };
  checkoutSession: { id: string; url: string | null };
  firstChargeDateStr: string;
  hasActiveSubscription: boolean;
  organization_id: string;
  org_slug: string | null | undefined;
}): Promise<void> {
  try {
    await queueEmail({
      organization_id,
      template_name: "enrollment-confirmation-stripe",
      payload: {
        enrollment_id: enrollment.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name || cleanFamilyNameForDisplay(family.family_name),
        is_student_recipient: recipient.isStudent,
        student_name: student.name,
        program_name: program.name,
        amount: enrollment.final_tuition,
        first_charge_date: firstChargeDateStr,
        enrolled_date: enrollment.enrolled_date,
        billing_anchor_date: enrollment.billing_anchor_date,
        payment_frequency: program.payment_frequency || "monthly",
        payment_type: program.payment_type,
        has_active_subscription: hasActiveSubscription,
        checkout_url: checkoutSession.url,
        checkout_session_id: checkoutSession.id,
        organization_slug: org_slug,
      },
    });
  } catch (queueError) {
    logger.error(
      "Failed to queue enrollment confirmation email",
      {
        error: queueError instanceof Error ? queueError.message : String(queueError),
        enrollmentId: enrollment.id,
      },
      "payments"
    );
  }
}

/**
 * Calculate billing parameters for regenerate flow
 */
export async function calculateRegenerateBillingParams({
  enrollment,
  program,
  orgTimezone,
  supabase,
}: {
  enrollment: EnrollmentQueryResult;
  program: ProgramData;
  orgTimezone: string;
  supabase: SupabaseClient;
}): Promise<{
  success: boolean;
  error?: string;
  firstChargeDate?: Date;
  subscriptionTrialEnd?: number;
  catchupLineItems?: CatchupLineItem[];
  pendingPaymentIds?: string[];
}> {
  const today = getTodayInOrgTimezone(orgTimezone);
  let billingDate: Date;

  if (enrollment.next_billing_date) {
    if (enrollment.next_billing_date <= today) {
      const currentBillingDate = parseDateInOrgTimezone(enrollment.next_billing_date, orgTimezone);
      billingDate = calculateNextBillingDate(
        currentBillingDate,
        (program.payment_frequency || "monthly") as BillingFrequency
      );
    } else {
      billingDate = parseDateInOrgTimezone(enrollment.next_billing_date, orgTimezone);
    }
  } else {
    billingDate = calculateNextBillingDate(
      new Date(),
      (program.payment_frequency || "monthly") as BillingFrequency
    );
  }

  let firstChargeDate = billingDate;
  let subscriptionTrialEnd = Math.floor(billingDate.getTime() / 1000);
  let catchupLineItems: CatchupLineItem[] | undefined;
  let pendingPaymentIds: string[] | undefined;

  // Check for pending manual invoices first
  const { data: pendingManualInvoices } = await supabase
    .from("payments")
    .select("id, amount, period_start, period_end, period_label")
    .eq("enrollment_id", enrollment.id)
    .eq("payment_source", "manual")
    .in("status", ["pending", "failed"])
    .order("period_start", { ascending: true });

  if (pendingManualInvoices && pendingManualInvoices.length > 0) {
    // Use actual pending invoices as catch-up items
    catchupLineItems = pendingManualInvoices.map((invoice) => ({
      description: invoice.period_label
        ? `${invoice.period_label} (past due)`
        : `Tuition payment (past due)`,
      amount: Math.round(invoice.amount * 100),
      period_start: invoice.period_start || today,
      period_end: invoice.period_end || today,
    }));

    pendingPaymentIds = pendingManualInvoices.map((inv) => inv.id);

    // Calculate first charge date from latest pending invoice
    const latestInvoice = pendingManualInvoices[pendingManualInvoices.length - 1];
    if (latestInvoice.period_end) {
      const latestPeriodEnd = parseDateInOrgTimezone(latestInvoice.period_end, orgTimezone);
      const nextDay = new Date(latestPeriodEnd);
      nextDay.setDate(nextDay.getDate() + 1);
      firstChargeDate = nextDay;
      subscriptionTrialEnd = Math.floor(nextDay.getTime() / 1000);

      logger.info(
        "Calculated first charge date from pending invoices",
        {
          enrollment_id: enrollment.id,
          latest_period_end: latestInvoice.period_end,
          first_charge_date: nextDay.toISOString().split("T")[0],
        },
        "payments"
      );
    }

    logger.info(
      "Found pending manual invoices for manual->Stripe conversion",
      {
        enrollment_id: enrollment.id,
        invoice_count: pendingManualInvoices.length,
        total_amount: pendingManualInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        payment_ids: pendingPaymentIds,
      },
      "payments"
    );
  } else if (enrollment.billing_anchor_date) {
    // Check for backdated enrollment needing catch-up
    const billingAnchorDate = parseDateInOrgTimezone(enrollment.billing_anchor_date, orgTimezone);
    const isBackdated = enrollment.billing_anchor_date < today;

    if (isBackdated && program.payment_frequency === "monthly") {
      const catchupCalculation = calculateCatchupCharges(
        billingAnchorDate,
        billingDate,
        enrollment.final_tuition,
        orgTimezone
      );

      if (catchupCalculation.lineItems.length > 0) {
        catchupLineItems = catchupCalculation.lineItems.map((item) => ({
          description: item.description,
          amount: item.amount,
          period_start: item.period_start,
          period_end: item.period_end,
        }));

        subscriptionTrialEnd = Math.floor(billingDate.getTime() / 1000);

        logger.info(
          "Backdated enrollment detected during regenerate - adding catch-up charges",
          {
            enrollment_id: enrollment.id,
            enrolled_date: enrollment.enrolled_date,
            next_billing_date: enrollment.next_billing_date,
            catchup_summary: catchupCalculation.summary,
            catchup_amount: catchupCalculation.totalAmount / 100,
          },
          "payments"
        );
      }
    } else if (isBackdated) {
      try {
        validateBackdatingAllowed(program.payment_frequency || "");
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : `Backdating is only allowed for monthly programs. This ${program.payment_frequency} program cannot be backdated.`,
        };
      }
    }
  }

  return {
    success: true,
    firstChargeDate,
    subscriptionTrialEnd,
    catchupLineItems,
    pendingPaymentIds,
  };
}

/**
 * Update one-time payment record
 */
export async function updateOneTimePaymentRecord({
  existingPayment,
  needsNewSession,
  checkoutSession,
  enrollment,
  student,
  orgTimezone,
  periodLabel,
  supabase,
  createPaymentFn,
}: {
  existingPayment: {
    id: string;
    stripe_checkout_session_id: string | null;
    created_at: string;
  } | null;
  needsNewSession: boolean;
  checkoutSession: { id: string } | undefined;
  enrollment: EnrollmentQueryResult;
  student: StudentData;
  orgTimezone: string;
  periodLabel: string | undefined;
  supabase: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPaymentFn: (input: any) => Promise<{ success: boolean }>;
}): Promise<void> {
  if (existingPayment) {
    const updates: { stripe_checkout_session_id?: string; notes?: string } = {};

    if (needsNewSession && checkoutSession) {
      updates.stripe_checkout_session_id = checkoutSession.id;
      updates.notes = `Payment link regenerated on ${getTodayInOrgTimezone(orgTimezone)}. Previous session expired.`;
    } else {
      updates.notes = `Payment link resent on ${getTodayInOrgTimezone(orgTimezone)}. Session still valid.`;
    }

    await PaymentsService.updateCheckoutSession(existingPayment.id, updates, supabase);
  } else {
    if (!checkoutSession) {
      throw new Error("Failed to create checkout session");
    }

    const todayInOrg = getTodayInOrgTimezone(orgTimezone);
    const [year, month, day] = todayInOrg.split("-").map(Number);
    const dueDate = new Date(Date.UTC(year, month - 1, day + 3)).toISOString().split("T")[0];

    await createPaymentFn({
      enrollment_id: enrollment.id,
      student_id: student.id,
      family_id: student.family_id,
      amount: enrollment.final_tuition,
      net_amount: enrollment.final_tuition,
      payment_source: "stripe",
      payment_method: undefined,
      status: "pending",
      stripe_checkout_session_id: checkoutSession.id,
      due_date: dueDate,
      period_label: periodLabel,
      notes: `Payment link generated on ${getTodayInOrgTimezone(orgTimezone)}`,
    });
  }
}

/**
 * Update subscription invite record
 */
export async function updateSubscriptionInviteRecord({
  existingInvite,
  needsNewSession,
  checkoutSession,
  enrollment,
  student,
  program,
  customerId,
  firstChargeDate,
  organization,
  orgTimezone,
  organization_id,
  supabase,
}: {
  existingInvite: {
    id: string;
    stripe_checkout_session_id: string | null;
    sent_at: string;
    stripe_coupon_id: string | null;
  } | null;
  needsNewSession: boolean;
  checkoutSession: { id: string; metadata?: Record<string, string> | null } | undefined;
  enrollment: EnrollmentQueryResult;
  student: StudentData;
  program: ProgramData;
  customerId: string;
  firstChargeDate: Date | null;
  organization: OrganizationData | null;
  orgTimezone: string;
  organization_id: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const firstChargeDateString = firstChargeDate
    ? firstChargeDate.toISOString().split("T")[0]
    : null;
  const inviteNote = firstChargeDateString
    ? `Onboarding checkout link ${needsNewSession ? "generated" : "resent"} on ${getTodayInOrgTimezone(orgTimezone)}. First charge scheduled for ${firstChargeDateString}.`
    : `Onboarding checkout link ${needsNewSession ? "generated" : "resent"} on ${getTodayInOrgTimezone(orgTimezone)}.`;

  if (existingInvite) {
    await StripeCheckoutInvitesService.update(
      {
        id: existingInvite.id,
        stripe_checkout_session_id:
          checkoutSession?.id || existingInvite.stripe_checkout_session_id || undefined,
        sent_at: new Date().toISOString(),
        first_charge_date: firstChargeDateString,
        notes: inviteNote,
        stripe_coupon_id:
          (checkoutSession?.metadata?.stripe_coupon_id as string | undefined | null) ||
          existingInvite.stripe_coupon_id,
      },
      supabase
    );
  } else {
    if (!checkoutSession) {
      throw new Error("Failed to create checkout session");
    }
    await StripeCheckoutInvitesService.create(
      {
        organization_id,
        enrollment_id: enrollment.id,
        student_id: student.id,
        family_id: student.family_id,
        program_id: program.id,
        stripe_customer_api_id: customerId,
        stripe_checkout_session_id: checkoutSession.id,
        planned_amount: enrollment.final_tuition,
        planned_currency: organization?.currency || "USD",
        stripe_coupon_id:
          (checkoutSession.metadata?.stripe_coupon_id as string | undefined | null) || null,
        first_charge_date: firstChargeDateString,
        notes: inviteNote,
      },
      supabase
    );
  }
}
