/**
 * Onboarding checkout link generation logic (legacy module name: auto-pay)
 * @module lib/payments/auto-pay
 */

import "server-only";

import { logger } from "@/lib/logger";
import { calculateAge } from "@/lib/utils";
import { getOrCreateStripeCustomer, createSubscriptionCheckoutSession } from "@/lib/stripe";
import { getOrCreateProgramPrice, updateProgramStripePrice } from "@/lib/stripe/program-prices";
import { calculateNextBillingDate } from "@/lib/billing/invoice-generator";
import {
  calculateCatchupCharges,
  validateBackdatingAllowed,
} from "@/lib/billing/catchup-calculator";
import { cleanFamilyNameForDisplay } from "@/lib/email/context";
import { getTodayInOrgTimezone, parseDateInOrgTimezone } from "@/lib/utils/timezone";
import { getOrgBaseUrl } from "./utils";
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

export interface CreateAutoPayCheckoutLinkParams {
  enrollment_id: string;
  organization_id: string;
  supabase: SupabaseClient;
}

export interface AutoPayCheckoutLinkResult {
  url: string | null;
  session_id: string;
  first_charge_date: string;
}

/**
 * Enrollment data for onboarding
 */
interface AutoPayEnrollmentData {
  id: string;
  organization_id: string;
  student_id?: string;
  family_id?: string;
  base_tuition: number;
  discount_amount?: number | null;
  final_tuition: number;
  next_billing_date?: string | null;
  billing_anchor_date?: string | null;
  enrolled_date?: string | null;
  billing_method?: string | null;
  student: unknown;
  family: unknown;
  program: unknown;
  organization: unknown;
}

/**
 * Extract nested data that may be array or object from Supabase joins
 */
function extractNested<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] as T;
  return raw as T;
}

/**
 * Create an onboarding checkout link for converting manual billing to Stripe subscription
 */
export async function createAutoPayCheckoutLinkLogic({
  enrollment_id,
  organization_id,
  supabase,
}: CreateAutoPayCheckoutLinkParams): Promise<PaymentActionResult<AutoPayCheckoutLinkResult>> {
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      organization_id,
      student_id,
      family_id,
      base_tuition,
      discount_amount,
      final_tuition,
      next_billing_date,
      billing_anchor_date,
      enrolled_date,
      billing_method,
      student:students(id, name, family_id, dob, student_email),
      family:families(id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email),
      program:programs(id, name, payment_type, payment_frequency, stripe_price_id, stripe_product_id, tuition_amount),
      organization:organizations(slug, timezone)
    `
    )
    .eq("id", enrollment_id)
    .eq("organization_id", organization_id)
    .single();

  if (error || !enrollment) {
    return { success: false, error: "Enrollment not found" };
  }

  const typedEnrollment = enrollment as unknown as AutoPayEnrollmentData;
  const program = extractNested<ProgramData>(typedEnrollment.program);

  if (!program || program.payment_type !== "recurring") {
    return { success: false, error: "Recurring payments are only available for recurring programs." };
  }

  const student = extractNested<StudentData>(typedEnrollment.student);
  const family = extractNested<FamilyData>(typedEnrollment.family);

  if (!student || !family) {
    return { success: false, error: "Missing student or family information." };
  }

  if (
    typedEnrollment.billing_method === "stripe_subscription" ||
    typedEnrollment.billing_method === "stripe_invoice"
  ) {
    return { success: false, error: "This enrollment is already enabled for recurring payments." };
  }

  // Determine recipient
  const studentAge = student.dob ? calculateAge(student.dob) : 0;
  const isAdult = studentAge >= 18;
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;

  if (isAdult && student.student_email) {
    recipientEmail = student.student_email;
    recipientName = student.name;
  } else {
    const primaryContactType = family.primary_contact_type || "father";
    recipientEmail =
      (primaryContactType === "father" ? family.father_email : family.mother_email) || null;
    recipientName =
      (primaryContactType === "father" ? family.father_name : family.mother_name) || null;
  }

  if (!recipientEmail) {
    return {
      success: false,
      error:
        "This family has no email on file. Add an email before enabling recurring payments so the checkout link can be delivered.",
    };
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({
    family_id: student.family_id,
    email: recipientEmail,
    name: recipientName || cleanFamilyNameForDisplay(family.family_name),
    organization_id,
  });

  // Get org timezone
  const { data: orgData } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", typedEnrollment.organization_id)
    .single();

  const orgTimezone = orgData?.timezone || "America/Los_Angeles";
  const today = getTodayInOrgTimezone(orgTimezone);

  // Calculate next billing date
  let nextBillingDate: Date;
  if (typedEnrollment.next_billing_date) {
    if (typedEnrollment.next_billing_date <= today) {
      const currentBillingDate = parseDateInOrgTimezone(
        typedEnrollment.next_billing_date,
        orgTimezone
      );
      nextBillingDate = calculateNextBillingDate(
        currentBillingDate,
        (program.payment_frequency || "monthly") as BillingFrequency,
        orgTimezone
      );
    } else {
      nextBillingDate = parseDateInOrgTimezone(typedEnrollment.next_billing_date, orgTimezone);
    }
  } else {
    nextBillingDate = calculateNextBillingDate(
      new Date(),
      (program.payment_frequency || "monthly") as BillingFrequency,
      orgTimezone
    );
  }

  // Calculate catch-up charges for backdated enrollments
  let catchupCharges: CatchupLineItem[] | undefined;
  let trialEnd: number | undefined;

  if (typedEnrollment.billing_anchor_date) {
    const billingAnchorDate = parseDateInOrgTimezone(
      typedEnrollment.billing_anchor_date,
      orgTimezone
    );
    const isBackdated = typedEnrollment.billing_anchor_date < today;

    if (isBackdated && program.payment_frequency === "monthly") {
      const catchupCalculation = calculateCatchupCharges(
        billingAnchorDate,
        nextBillingDate,
        typedEnrollment.final_tuition,
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
            enrollment_id: typedEnrollment.id,
            billing_anchor_date: typedEnrollment.billing_anchor_date,
            next_billing_date: typedEnrollment.next_billing_date,
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
    } else {
      trialEnd = Math.floor(nextBillingDate.getTime() / 1000);
    }
  } else {
    trialEnd = Math.floor(nextBillingDate.getTime() / 1000);
  }

  // Ensure program has a Stripe price
  let stripePriceId = program.stripe_price_id;
  if (!stripePriceId) {
    const priceData = await getOrCreateProgramPrice({
      program_id: program.id,
      program_name: program.name,
      tuition_amount: program.tuition_amount,
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

  const org = extractNested<OrganizationData>(typedEnrollment.organization);
  const baseUrl = getOrgBaseUrl(org?.slug);
  const success_url = `${baseUrl}/students/${student.id}?autopay=success`;
  const cancel_url = `${baseUrl}/students/${student.id}?autopay=cancelled`;

  const session = await createSubscriptionCheckoutSession({
    enrollment_id: typedEnrollment.id,
    student_id: student.id,
    family_id: student.family_id,
    student_name: student.name,
    program_id: program.id,
    program_name: program.name,
    base_tuition: typedEnrollment.base_tuition,
    discount_amount: typedEnrollment.discount_amount || 0,
    final_tuition: typedEnrollment.final_tuition,
    frequency: (program.payment_frequency || "monthly") as BillingFrequency,
    customer_id: customerId,
    success_url,
    cancel_url,
    organization_id,
    stripe_price_id: stripePriceId,
    converting_from_manual: true,
    trial_end: trialEnd,
    catchup_line_items: catchupCharges,
  });

  return {
    success: true,
    data: {
      url: session.url,
      session_id: session.id,
      first_charge_date: nextBillingDate.toISOString().split("T")[0],
    },
  };
}
