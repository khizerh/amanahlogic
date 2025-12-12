/**
 * Customer portal link logic
 * @module lib/payments/customer-portal
 */

import "server-only";

import { logger } from "@imarah/logger";
import { calculateAge } from "@imarah/shared-utils";
import { getOrCreateStripeCustomer, createCustomerPortalSession } from "@/lib/stripe";
import { cleanFamilyNameForDisplay } from "@/lib/email/context";
import { queueEmail } from "@/lib/email/queue";
import { getOrgBaseUrl, isStripeConfigurationError, isStripeResourceMissingError } from "./utils";
import type { PaymentActionResult, FamilyData, OrganizationData } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SendCustomerPortalLinkParams {
  family_id: string;
  enrollment_id?: string;
  organization_id: string;
  supabase: SupabaseClient;
}

export interface CustomerPortalLinkResult {
  url: string;
}

/**
 * Family data with organization for portal
 */
interface FamilyWithOrg {
  id: string;
  family_name: string;
  primary_contact_type?: string | null;
  father_name?: string | null;
  father_email?: string | null;
  mother_name?: string | null;
  mother_email?: string | null;
  organization: unknown;
}

/**
 * Extract nested organization data
 */
function extractOrg(raw: unknown): OrganizationData | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] as OrganizationData;
  return raw as OrganizationData;
}

/**
 * Send Stripe Customer Portal link to family via email
 */
export async function sendCustomerPortalLinkLogic({
  family_id,
  enrollment_id,
  organization_id,
  supabase,
}: SendCustomerPortalLinkParams): Promise<PaymentActionResult<CustomerPortalLinkResult>> {
  // Get family details
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select(
      "id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email, organization:organizations(slug, name, email, phone)"
    )
    .eq("id", family_id)
    .eq("organization_id", organization_id)
    .single();

  if (familyError || !family) {
    return { success: false, error: "Family not found" };
  }

  const typedFamily = family as unknown as FamilyWithOrg;
  const organization = extractOrg(typedFamily.organization);
  const org_slug = organization?.slug;

  // Determine primary contact
  const primaryContactType = typedFamily.primary_contact_type || "father";
  let recipientEmail =
    primaryContactType === "father" ? typedFamily.father_email : typedFamily.mother_email;
  let recipientName =
    primaryContactType === "father" ? typedFamily.father_name : typedFamily.mother_name;

  // Fallback 1: Try secondary parent
  if (!recipientEmail) {
    recipientEmail =
      primaryContactType === "father" ? typedFamily.mother_email : typedFamily.father_email;
    recipientName =
      primaryContactType === "father" ? typedFamily.mother_name : typedFamily.father_name;
  }

  // Fallback 2: Try adult students
  if (!recipientEmail) {
    const { data: students } = await supabase
      .from("students")
      .select("id, name, student_email, dob")
      .eq("family_id", family_id)
      .eq("organization_id", organization_id)
      .not("student_email", "is", null);

    if (students && students.length > 0) {
      const adultStudent = students.find((s) => {
        if (!s.dob) return false;
        return calculateAge(s.dob) >= 18;
      });

      if (adultStudent && adultStudent.student_email) {
        recipientEmail = adultStudent.student_email;
        recipientName = adultStudent.name;
      }
    }
  }

  if (!recipientEmail) {
    return {
      success: false,
      error:
        "No email address found for primary contact, secondary contact, or adult students in this family.",
    };
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({
    family_id,
    email: recipientEmail,
    name: recipientName || cleanFamilyNameForDisplay(typedFamily.family_name),
    organization_id,
  });

  const baseUrl = getOrgBaseUrl(org_slug);
  const return_url = `${baseUrl}/students`;

  const portalSession = await createCustomerPortalSession({
    customer_id: customerId,
    return_url,
    organization_id,
  });

  // Queue email with portal link
  try {
    await queueEmail({
      organization_id,
      template_name: "customer-portal-link",
      payload: {
        recipient_email: recipientEmail,
        recipient_name: recipientName || cleanFamilyNameForDisplay(typedFamily.family_name),
        is_student_recipient: false,
        portal_url: portalSession.url,
        organization_name: organization?.name || null,
        organization_email: organization?.email || null,
        organization_phone: organization?.phone || null,
        family_id,
        enrollment_id: enrollment_id || null,
        organization_id,
      },
    });

    logger.info(
      "Customer portal link email queued",
      { familyId: family_id, enrollmentId: enrollment_id },
      "payments"
    );
  } catch (emailError) {
    logger.error(
      "Failed to queue customer portal link email",
      {
        error: emailError instanceof Error ? emailError.message : String(emailError),
        familyId: family_id,
      },
      "payments"
    );
    return {
      success: false,
      error: "Portal link generated but failed to send email. Please try again.",
    };
  }

  return {
    success: true,
    data: {
      url: portalSession.url,
    },
  };
}

export interface GenerateCustomerPortalLinkParams {
  family_id: string;
  organization_id: string;
  supabase: SupabaseClient;
}

/**
 * Generate a Stripe Customer Portal link for a family (without email)
 * @deprecated Use sendCustomerPortalLinkLogic() to send via email instead
 */
export async function generateCustomerPortalLinkLogic({
  family_id,
  organization_id,
  supabase,
}: GenerateCustomerPortalLinkParams): Promise<PaymentActionResult<CustomerPortalLinkResult>> {
  // Get family details
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select(
      "id, family_name, primary_contact_type, father_name, father_email, mother_name, mother_email, organization:organizations(slug)"
    )
    .eq("id", family_id)
    .eq("organization_id", organization_id)
    .single();

  if (familyError || !family) {
    return { success: false, error: "Family not found" };
  }

  const typedFamily = family as unknown as FamilyWithOrg;
  const organization = extractOrg(typedFamily.organization);
  const org_slug = organization?.slug;

  // Determine primary contact
  const primaryContactType = typedFamily.primary_contact_type || "father";
  let recipientEmail =
    primaryContactType === "father" ? typedFamily.father_email : typedFamily.mother_email;
  let recipientName =
    primaryContactType === "father" ? typedFamily.father_name : typedFamily.mother_name;

  // Fallback 1: Try secondary parent
  if (!recipientEmail) {
    recipientEmail =
      primaryContactType === "father" ? typedFamily.mother_email : typedFamily.father_email;
    recipientName =
      primaryContactType === "father" ? typedFamily.mother_name : typedFamily.father_name;
  }

  // Fallback 2: Try adult students
  if (!recipientEmail) {
    const { data: students } = await supabase
      .from("students")
      .select("id, name, student_email, dob")
      .eq("family_id", family_id)
      .eq("organization_id", organization_id)
      .not("student_email", "is", null);

    if (students && students.length > 0) {
      const adultStudent = students.find((s) => {
        if (!s.dob) return false;
        return calculateAge(s.dob) >= 18;
      });

      if (adultStudent && adultStudent.student_email) {
        recipientEmail = adultStudent.student_email;
        recipientName = adultStudent.name;
      }
    }
  }

  if (!recipientEmail) {
    return {
      success: false,
      error:
        "No email address found for primary contact, secondary contact, or adult students in this family.",
    };
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({
    family_id,
    email: recipientEmail,
    name: recipientName || cleanFamilyNameForDisplay(typedFamily.family_name),
    organization_id,
  });

  const baseUrl = getOrgBaseUrl(org_slug);
  const return_url = `${baseUrl}/students`;

  const portalSession = await createCustomerPortalSession({
    customer_id: customerId,
    return_url,
    organization_id,
  });

  return {
    success: true,
    data: {
      url: portalSession.url,
    },
  };
}

/**
 * Handle Stripe portal errors and return appropriate error messages
 */
export function handlePortalError(error: unknown): string {
  if (isStripeConfigurationError(error)) {
    return "Stripe Customer Portal needs to be configured. Go to Stripe Dashboard → Settings → Customer Portal and create your default configuration first.";
  }

  if (isStripeResourceMissingError(error)) {
    return "This family has not been set up in Stripe yet. Generate a payment link first to create their Stripe customer account.";
  }

  return error instanceof Error ? error.message : "Failed to create portal session";
}
