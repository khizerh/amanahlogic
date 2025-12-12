/**
 * Shared utilities for payment operations
 * @module lib/payments/utils
 */

import { calculateAge } from "@/lib/utils";
import type { FamilyData, StudentData } from "./types";

/**
 * Get organization-specific base URL using subdomain
 */
export function getOrgBaseUrl(orgSlug?: string | null): string {
  const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "imarah.io";

  if (orgSlug) {
    return `https://${orgSlug}.${baseDomain}`;
  }

  // Fallback to generic app URL if no slug available
  return process.env.NEXT_PUBLIC_BASE_URL || `https://app.${baseDomain}`;
}

/**
 * Build success/cancel URLs for Stripe checkout
 */
export function buildCheckoutUrls(
  orgSlug: string | null | undefined,
  returnPath: string,
  queryParams: { success: string; cancelled: string }
): { successUrl: string; cancelUrl: string } {
  const baseUrl = getOrgBaseUrl(orgSlug);
  return {
    successUrl: `${baseUrl}${returnPath}?payment=${queryParams.success}`,
    cancelUrl: `${baseUrl}${returnPath}?payment=${queryParams.cancelled}`,
  };
}

/**
 * Resolve the payment recipient (email + name) based on student age and family contacts
 *
 * For adults (18+) with email: sends to student
 * For minors or adults without email: sends to primary family contact
 */
export function resolvePaymentRecipient(
  student: StudentData,
  family: FamilyData
): {
  email: string | null;
  name: string | null;
  isStudent: boolean;
  error?: string;
} {
  const studentAge = student.dob ? calculateAge(student.dob) : 0;
  const isAdult = studentAge >= 18;

  // Adult with email -> send to student
  if (isAdult && student.student_email) {
    return {
      email: student.student_email,
      name: student.name,
      isStudent: true,
    };
  }

  // Minor or adult without email -> send to primary contact
  const primaryContactType = family.primary_contact_type || "father";
  const email =
    (primaryContactType === "father" ? family.father_email : family.mother_email) ?? null;
  const name = (primaryContactType === "father" ? family.father_name : family.mother_name) ?? null;

  if (!email) {
    return {
      email: null,
      name: null,
      isStudent: false,
      error: `Primary contact (${primaryContactType}) has no email address.${isAdult ? " Student also has no email." : ""}`,
    };
  }

  return {
    email,
    name,
    isStudent: false,
  };
}

/**
 * Resolve recipient with fallback to secondary parent and adult students
 * More comprehensive fallback chain for customer portal links
 */
export async function resolveRecipientWithFallback(
  family: FamilyData,
  findAdultStudentEmail?: () => Promise<{ email: string; name: string } | null>
): Promise<{
  email: string | null;
  name: string | null;
  isStudent: boolean;
  error?: string;
}> {
  const primaryContactType = family.primary_contact_type || "father";

  // Try primary contact
  let email: string | null =
    (primaryContactType === "father" ? family.father_email : family.mother_email) ?? null;
  let name: string | null =
    (primaryContactType === "father" ? family.father_name : family.mother_name) ?? null;

  if (email) {
    return { email, name, isStudent: false };
  }

  // Fallback 1: Try secondary parent
  email = (primaryContactType === "father" ? family.mother_email : family.father_email) ?? null;
  name = (primaryContactType === "father" ? family.mother_name : family.father_name) ?? null;

  if (email) {
    return { email, name, isStudent: false };
  }

  // Fallback 2: Try adult students via callback
  if (findAdultStudentEmail) {
    const adultStudent = await findAdultStudentEmail();
    if (adultStudent) {
      return {
        email: adultStudent.email,
        name: adultStudent.name,
        isStudent: true,
      };
    }
  }

  return {
    email: null,
    name: null,
    isStudent: false,
    error:
      "No email address found for primary contact, secondary contact, or adult students in this family.",
  };
}

/**
 * Format an error for action result
 */
export function formatError(
  error: unknown,
  fallbackMessage: string = "Unknown error occurred"
): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error) || fallbackMessage;
}

/**
 * Check if a Stripe error is a configuration error
 */
export function isStripeConfigurationError(error: unknown): boolean {
  const message = (error as { message?: string })?.message;
  return !!message?.includes("configuration");
}

/**
 * Check if a Stripe error is a resource missing error
 */
export function isStripeResourceMissingError(error: unknown): boolean {
  const err = error as { type?: string; code?: string };
  return err?.type === "StripeInvalidRequestError" && err?.code === "resource_missing";
}
