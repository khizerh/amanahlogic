/**
 * Payment link generation logic
 * @module lib/payments/payment-link
 */

import "server-only";

import { logger } from "@/lib/logger";
import {
  getOrCreateStripeCustomer,
  createOneTimeCheckoutSession,
  createSubscriptionCheckoutSession,
  getStripeClient,
} from "@/lib/stripe";
import { getOrCreateProgramPrice, updateProgramStripePrice } from "@/lib/stripe/program-prices";
import { PaymentsService } from "@/lib/database/payments";
import { StripeCheckoutInvitesService } from "@/lib/database/stripe-checkout-invites";
import { formatPeriodLabel } from "@/lib/billing";
import { cleanFamilyNameForDisplay } from "@/lib/email/context";
import { getTodayInOrgTimezone } from "@/lib/utils/timezone";
import { getOrgBaseUrl, resolvePaymentRecipient } from "./utils";
import {
  extractNested,
  calculateRecurringBillingParams,
  logCheckoutInvite,
  queuePaymentLinkEmail,
  calculateRegenerateBillingParams,
  updateOneTimePaymentRecord,
  updateSubscriptionInviteRecord,
  type EnrollmentQueryResult,
} from "./payment-link-helpers";
import type {
  PaymentActionResult,
  StudentData,
  FamilyData,
  ProgramData,
  OrganizationData,
  CatchupLineItem,
  BillingFrequency,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export types and helpers for external use
export { extractNestedData } from "./types";
export type { EnrollmentQueryResult } from "./payment-link-helpers";

export interface GeneratePaymentLinkParams {
  enrollment_id: string;
  organization_id: string;
  supabase: SupabaseClient;
}

export interface PaymentLinkResult {
  url: string | null;
  session_id: string;
  first_charge_date?: string;
}

/**
 * Generate a payment link for an enrollment using Stripe Checkout
 */
export async function generatePaymentLinkLogic({
  enrollment_id,
  organization_id,
  supabase,
}: GeneratePaymentLinkParams): Promise<PaymentActionResult<PaymentLinkResult>> {
  // Get enrollment with student, family, and program details
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      organization_id,
      enrolled_date,
      billing_anchor_date,
      base_tuition,
      discount_amount,
      discount_type,
      final_tuition,
      next_billing_date,
      student:students(id, name, family_id, dob, student_email),
      program:programs(id, name, payment_type, payment_frequency, tuition_amount, stripe_price_id, stripe_product_id),
      family:families(id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email),
      organization:organizations(slug, timezone, currency)
    `
    )
    .eq("id", enrollment_id)
    .eq("organization_id", organization_id)
    .single();

  if (error || !enrollment) {
    logger.error(
      "generatePaymentLink: Failed to fetch enrollment",
      {
        enrollment_id,
        organization_id,
        error: error?.message || "No error",
        errorCode: error?.code,
      },
      "payments"
    );
    return { success: false, error: error?.message || "Enrollment not found" };
  }

  const typedEnrollment = enrollment as unknown as EnrollmentQueryResult;
  const organization = extractNested<OrganizationData>(typedEnrollment.organization);
  const org_slug = organization?.slug;
  const orgTimezone = organization?.timezone || "America/Los_Angeles";

  const student = extractNested<StudentData>(typedEnrollment.student);
  const family = extractNested<FamilyData>(typedEnrollment.family);
  const program = extractNested<ProgramData>(typedEnrollment.program);

  if (!student || !family || !program) {
    logger.error(
      "generatePaymentLink: Missing required data",
      { enrollment_id, hasStudent: !!student, hasFamily: !!family, hasProgram: !!program },
      "payments"
    );
    return {
      success: false,
      error: `Required data not found: ${!student ? "student" : ""} ${!family ? "family" : ""} ${!program ? "program" : ""}`,
    };
  }

  // Calculate billing dates and catch-up charges for recurring programs
  let nextBillingDate: Date | null = null;
  let catchupCharges: CatchupLineItem[] | undefined;
  let trialEnd: number | undefined;

  if (program.payment_type === "recurring") {
    const result = calculateRecurringBillingParams({
      enrollment: typedEnrollment,
      program,
      orgTimezone,
    });
    if (!result.success) return { success: false, error: result.error! };
    nextBillingDate = result.nextBillingDate!;
    catchupCharges = result.catchupCharges;
    trialEnd = result.trialEnd;
  }

  // Resolve recipient
  const recipientResult = resolvePaymentRecipient(student, family);
  if (!recipientResult.email) return { success: false, error: recipientResult.error! };
  const recipient = {
    email: recipientResult.email,
    name: recipientResult.name,
    isStudent: recipientResult.isStudent,
  };

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({
    family_id: student.family_id,
    email: recipient.email,
    name: recipient.name || cleanFamilyNameForDisplay(family.family_name),
    organization_id,
  });

  const baseUrl = getOrgBaseUrl(org_slug);
  const success_url = `${baseUrl}/enrollments?payment=success`;
  const cancel_url = `${baseUrl}/enrollments?payment=cancelled`;

  let checkoutSession;
  let subscriptionTrialEnd: number | undefined;

  // Create appropriate checkout session
  if (program.payment_type === "one_time") {
    checkoutSession = await createOneTimeCheckoutSession({
      enrollment_id: typedEnrollment.id,
      student_id: student.id,
      family_id: student.family_id,
      student_name: student.name,
      program_name: program.name,
      program_id: program.id,
      amount: typedEnrollment.final_tuition,
      base_tuition: typedEnrollment.base_tuition,
      discount_amount: typedEnrollment.discount_amount ?? undefined,
      customer_id: customerId,
      success_url,
      cancel_url,
      organization_id,
    });
  } else {
    subscriptionTrialEnd = trialEnd;
    checkoutSession = await createSubscriptionCheckoutSession({
      enrollment_id: typedEnrollment.id,
      student_id: student.id,
      family_id: student.family_id,
      student_name: student.name,
      program_id: program.id,
      program_name: program.name,
      base_tuition: typedEnrollment.base_tuition,
      discount_amount: typedEnrollment.discount_amount ?? undefined,
      final_tuition: typedEnrollment.final_tuition,
      frequency: (program.payment_frequency || "monthly") as BillingFrequency,
      customer_id: customerId,
      success_url,
      cancel_url,
      organization_id,
      stripe_price_id: program.stripe_price_id,
      converting_from_manual: true,
      trial_end: subscriptionTrialEnd,
      catchup_line_items: catchupCharges,
    });
  }

  // Log checkout invite
  await logCheckoutInvite({
    enrollment: typedEnrollment,
    student,
    program,
    customerId,
    checkoutSession,
    subscriptionTrialEnd,
    organization_id,
    organization,
    orgTimezone,
    supabase,
  });

  // Check for active subscription
  const { data: activeSubscription } = await supabase
    .from("stripe_subscriptions")
    .select("id")
    .eq("enrollment_id", typedEnrollment.id)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  // Queue confirmation email
  const firstChargeDateStr =
    typedEnrollment.next_billing_date || getTodayInOrgTimezone(orgTimezone);
  await queuePaymentLinkEmail({
    enrollment: typedEnrollment,
    student,
    family,
    program,
    recipient,
    checkoutSession,
    firstChargeDateStr,
    hasActiveSubscription: !!activeSubscription,
    organization_id,
    org_slug,
  });

  return { success: true, data: { url: checkoutSession.url, session_id: checkoutSession.id } };
}

export interface RegeneratePaymentLinkParams {
  enrollment_id: string;
  organization_id: string;
  supabase: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPaymentFn: (input: any) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

/**
 * Regenerate a payment link for an existing enrollment
 */
export async function regeneratePaymentLinkLogic({
  enrollment_id,
  organization_id,
  supabase,
  createPaymentFn,
}: RegeneratePaymentLinkParams): Promise<
  PaymentActionResult<PaymentLinkResult> & { message?: string }
> {
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .select(
      `
      id, organization_id, enrolled_date, billing_anchor_date, base_tuition, discount_amount, final_tuition, billing_method, next_billing_date,
      student:students!inner(id, name, family_id, dob, student_email),
      program:programs!inner(id, name, payment_type, payment_frequency, tuition_amount, stripe_price_id, stripe_product_id),
      family:families!inner(id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email),
      organization:organizations!inner(slug, timezone, currency)
    `
    )
    .eq("id", enrollment_id)
    .eq("organization_id", organization_id)
    .single();

  if (error || !enrollment) return { success: false, error: "Enrollment not found" };

  const typedEnrollment = enrollment as unknown as EnrollmentQueryResult;
  const student = extractNested<StudentData>(typedEnrollment.student);
  const family = extractNested<FamilyData>(typedEnrollment.family);
  const program = extractNested<ProgramData>(typedEnrollment.program);
  const organization = extractNested<OrganizationData>(typedEnrollment.organization);
  const org_slug = organization?.slug;
  const orgTimezone = organization?.timezone || "America/Los_Angeles";

  if (!student || !family || !program) {
    return { success: false, error: "Enrollment is missing student, family, or program data" };
  }

  const isOneTime = program.payment_type === "one_time";
  let firstChargeDate: Date | null = null;
  let subscriptionTrialEnd: number | undefined;
  let catchupLineItems: CatchupLineItem[] | undefined;
  let pendingPaymentIds: string[] | undefined;

  if (!isOneTime) {
    const billingParams = await calculateRegenerateBillingParams({
      enrollment: typedEnrollment,
      program,
      orgTimezone,
      supabase,
    });
    if (!billingParams.success) return { success: false, error: billingParams.error! };
    firstChargeDate = billingParams.firstChargeDate!;
    subscriptionTrialEnd = billingParams.subscriptionTrialEnd;
    catchupLineItems = billingParams.catchupLineItems;
    pendingPaymentIds = billingParams.pendingPaymentIds;
  }

  // Resolve recipient
  const recipientResult = resolvePaymentRecipient(student, family);
  if (!recipientResult.email) return { success: false, error: recipientResult.error! };
  const recipient = {
    email: recipientResult.email,
    name: recipientResult.name,
    isStudent: recipientResult.isStudent,
  };

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({
    family_id: student.family_id,
    email: recipient.email,
    name: recipient.name || cleanFamilyNameForDisplay(family.family_name),
    organization_id,
  });

  const baseUrl = getOrgBaseUrl(org_slug);
  const success_url = `${baseUrl}/enrollments?payment=success`;
  const cancel_url = `${baseUrl}/enrollments?payment=cancelled`;
  const periodStart = new Date();
  const periodLabel = isOneTime
    ? undefined
    : formatPeriodLabel(periodStart, program.payment_frequency || "monthly");

  // Check for existing session
  let existingPayment: {
    id: string;
    stripe_checkout_session_id: string | null;
    created_at: string;
  } | null = null;
  let existingInvite = null;

  if (isOneTime) {
    const { data } = await supabase
      .from("payments")
      .select("id, stripe_checkout_session_id, created_at")
      .eq("enrollment_id", enrollment_id)
      .eq("payment_source", "stripe")
      .eq("status", "pending")
      .not("stripe_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingPayment = data;
  } else {
    existingInvite = await StripeCheckoutInvitesService.getPendingForEnrollment(
      enrollment_id,
      supabase
    );
  }

  let checkoutSession:
    | { id: string; url: string | null; metadata?: Record<string, string> | null }
    | undefined;
  let sessionUrl: string | null = null;
  let needsNewSession = true;

  const hasCatchupCharges = catchupLineItems && catchupLineItems.length > 0;

  if (!hasCatchupCharges) {
    const existingSessionId = isOneTime
      ? existingPayment?.stripe_checkout_session_id
      : existingInvite?.stripe_checkout_session_id;
    if (existingSessionId) {
      const sessionCreatedAt = isOneTime
        ? new Date(existingPayment!.created_at)
        : new Date(existingInvite!.sent_at);
      const hoursSinceCreation =
        (new Date().getTime() - sessionCreatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation < 24) {
        try {
          const stripe = await getStripeClient(organization_id);
          const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);
          if (existingSession.status === "open" && existingSession.url) {
            needsNewSession = false;
            sessionUrl = existingSession.url;
            checkoutSession = existingSession;
          }
        } catch {
          // Session expired or invalid, will create new one
        }
      }
    }
  }

  if (needsNewSession) {
    if (isOneTime) {
      checkoutSession = await createOneTimeCheckoutSession({
        enrollment_id: typedEnrollment.id,
        student_id: student.id,
        family_id: student.family_id,
        student_name: student.name,
        program_name: program.name,
        amount: typedEnrollment.final_tuition,
        customer_id: customerId,
        success_url,
        cancel_url,
        organization_id,
      });
    } else {
      checkoutSession = await createSubscriptionCheckoutSession({
        enrollment_id: typedEnrollment.id,
        student_id: student.id,
        family_id: student.family_id,
        student_name: student.name,
        program_id: program.id,
        program_name: program.name,
        base_tuition: typedEnrollment.base_tuition,
        discount_amount: typedEnrollment.discount_amount ?? undefined,
        final_tuition: typedEnrollment.final_tuition,
        frequency: (program.payment_frequency || "monthly") as BillingFrequency,
        customer_id: customerId,
        success_url,
        cancel_url,
        organization_id,
        stripe_price_id: program.stripe_price_id,
        converting_from_manual: true,
        trial_end: subscriptionTrialEnd ?? undefined,
        catchup_line_items: catchupLineItems,
        pending_payment_ids: pendingPaymentIds,
      });
    }
    sessionUrl = checkoutSession.url!;
  }

  if (isOneTime) {
    await updateOneTimePaymentRecord({
      existingPayment,
      needsNewSession,
      checkoutSession,
      enrollment: typedEnrollment,
      student,
      orgTimezone,
      periodLabel,
      supabase,
      createPaymentFn,
    });
  } else {
    await updateSubscriptionInviteRecord({
      existingInvite,
      needsNewSession,
      checkoutSession,
      enrollment: typedEnrollment,
      student,
      program,
      customerId,
      firstChargeDate,
      organization,
      orgTimezone,
      organization_id,
      supabase,
    });
  }

  if (!checkoutSession || !sessionUrl) throw new Error("Checkout session or URL is missing");

  const firstChargeDateStr = firstChargeDate
    ? firstChargeDate.toISOString().split("T")[0]
    : typedEnrollment.next_billing_date || getTodayInOrgTimezone(orgTimezone);
  await queuePaymentLinkEmail({
    enrollment: typedEnrollment,
    student,
    family,
    program,
    recipient,
    checkoutSession,
    firstChargeDateStr,
    hasActiveSubscription: false,
    organization_id,
    org_slug,
  });

  return {
    success: true,
    data: { url: sessionUrl, session_id: checkoutSession.id },
    message: needsNewSession
      ? "New payment link generated and sent via email."
      : "Payment link resent via email (original link still active).",
  };
}

export interface GetPaymentLinkUrlParams {
  enrollment_id: string;
  organization_id: string;
  supabase: SupabaseClient;
}

export interface GetPaymentLinkUrlResult {
  url: string;
  session_id: string;
  isNewSession: boolean;
}

/**
 * Get payment link URL without sending email (for "Copy Link" functionality)
 */
export async function getPaymentLinkUrlLogic({
  enrollment_id,
  organization_id,
  supabase,
}: GetPaymentLinkUrlParams): Promise<PaymentActionResult<GetPaymentLinkUrlResult>> {
  const { data: enrollment, error: fetchError } = await supabase
    .from("enrollments")
    .select(
      `
      id, student_id, final_tuition, enrolled_date, next_billing_date, billing_method,
      student:students!inner(id, name, dob, student_email, family_id),
      family:families!inner(id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email),
      program:programs!inner(id, name, payment_type, payment_frequency, stripe_price_id, stripe_product_id),
      organization:organizations!inner(slug, timezone, currency)
    `
    )
    .eq("id", enrollment_id)
    .eq("organization_id", organization_id)
    .single();

  if (fetchError || !enrollment) return { success: false, error: "Enrollment not found" };

  const typedEnrollment = enrollment as unknown as EnrollmentQueryResult;
  const student = extractNested<StudentData>(typedEnrollment.student);
  const family = extractNested<FamilyData>(typedEnrollment.family);
  const program = extractNested<ProgramData>(typedEnrollment.program);
  const organization = extractNested<OrganizationData>(typedEnrollment.organization);
  const org_slug = organization?.slug;
  const orgTimezone = organization?.timezone || "America/Los_Angeles";

  if (!student || !family || !program)
    return { success: false, error: "Missing student, family, or program data" };

  const isOneTime = program.payment_type === "one_time";
  const recipientResult = resolvePaymentRecipient(student, family);
  if (!recipientResult.email) return { success: false, error: recipientResult.error! };

  const customerId = await getOrCreateStripeCustomer({
    family_id: student.family_id,
    email: recipientResult.email,
    name: recipientResult.name || cleanFamilyNameForDisplay(family.family_name),
    organization_id,
  });

  const baseUrl = getOrgBaseUrl(org_slug);
  const success_url = `${baseUrl}/enrollments?payment=success`;
  const cancel_url = `${baseUrl}/enrollments?payment=cancelled`;

  // Check for existing session
  let existingSessionId: string | null = null;
  let sessionCreatedAt: Date | null = null;

  if (isOneTime) {
    const { data } = await supabase
      .from("payments")
      .select("id, stripe_checkout_session_id, created_at")
      .eq("enrollment_id", enrollment_id)
      .eq("payment_source", "stripe")
      .eq("status", "pending")
      .not("stripe_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.stripe_checkout_session_id) {
      existingSessionId = data.stripe_checkout_session_id;
      sessionCreatedAt = new Date(data.created_at);
    }
  } else {
    const existingInvite = await StripeCheckoutInvitesService.getPendingForEnrollment(
      enrollment_id,
      supabase
    );
    if (existingInvite?.stripe_checkout_session_id) {
      existingSessionId = existingInvite.stripe_checkout_session_id;
      sessionCreatedAt = new Date(existingInvite.sent_at);
    }
  }

  // Try to reuse existing session
  if (existingSessionId && sessionCreatedAt) {
    const hoursSinceCreation =
      (new Date().getTime() - sessionCreatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation < 24) {
      try {
        const stripe = await getStripeClient(organization_id);
        const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);
        if (existingSession.status === "open" && existingSession.url) {
          return {
            success: true,
            data: { url: existingSession.url, session_id: existingSession.id, isNewSession: false },
          };
        }
      } catch {
        // Session invalid, create new one
      }
    }
  }

  // Create new checkout session
  let checkoutSession;

  if (isOneTime) {
    checkoutSession = await createOneTimeCheckoutSession({
      enrollment_id: typedEnrollment.id,
      student_id: student.id,
      family_id: student.family_id,
      student_name: student.name,
      program_name: program.name,
      amount: typedEnrollment.final_tuition,
      customer_id: customerId,
      success_url,
      cancel_url,
      organization_id,
    });

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("enrollment_id", enrollment_id)
      .eq("payment_source", "stripe")
      .eq("status", "pending")
      .maybeSingle();

    if (existingPayment) {
      await PaymentsService.updateCheckoutSession(
        existingPayment.id,
        { stripe_checkout_session_id: checkoutSession.id },
        supabase
      );
    }
  } else {
    let stripePriceId = program.stripe_price_id;
    if (!stripePriceId) {
      const priceData = await getOrCreateProgramPrice({
        program_id: program.id,
        program_name: program.name,
        tuition_amount: typedEnrollment.final_tuition,
        payment_frequency: (program.payment_frequency || "monthly") as BillingFrequency,
        organization_id,
        existing_stripe_price_id: program.stripe_price_id,
        existing_stripe_product_id: program.stripe_product_id,
      });
      await updateProgramStripePrice({
        program_id: program.id,
        stripe_price_id: priceData.stripe_price_id,
        stripe_product_id: priceData.stripe_product_id,
        organization_id,
      });
      stripePriceId = priceData.stripe_price_id;
    }

    checkoutSession = await createSubscriptionCheckoutSession({
      enrollment_id: typedEnrollment.id,
      student_id: student.id,
      family_id: student.family_id,
      student_name: student.name,
      program_id: program.id,
      program_name: program.name,
      base_tuition: typedEnrollment.final_tuition,
      discount_amount: 0,
      final_tuition: typedEnrollment.final_tuition,
      frequency: (program.payment_frequency || "monthly") as BillingFrequency,
      customer_id: customerId,
      success_url,
      cancel_url,
      organization_id,
      stripe_price_id: stripePriceId,
      converting_from_manual: true,
    });

    await StripeCheckoutInvitesService.cancelPendingForEnrollment(enrollment_id, supabase);
    await StripeCheckoutInvitesService.create(
      {
        organization_id,
        enrollment_id: typedEnrollment.id,
        student_id: student.id,
        family_id: student.family_id,
        program_id: program.id,
        stripe_customer_api_id: customerId,
        stripe_checkout_session_id: checkoutSession.id,
        planned_amount: typedEnrollment.final_tuition,
        planned_currency: organization?.currency || "USD",
        first_charge_date: typedEnrollment.next_billing_date || getTodayInOrgTimezone(orgTimezone),
        notes: "Payment link generated (copy link).",
      },
      supabase
    );
  }

  return {
    success: true,
    data: { url: checkoutSession.url!, session_id: checkoutSession.id, isNewSession: true },
  };
}
