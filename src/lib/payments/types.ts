/**
 * Shared types for payment operations
 * @module lib/payments/types
 */

/**
 * Standard action result shape used across all payment operations
 */
export type PaymentActionResult<T = unknown> =
  | {
      success: true;
      data: T;
      message?: string;
    }
  | {
      success: false;
      error: string;
      message?: string;
    };

/**
 * Student data extracted from enrollment joins
 */
export interface StudentData {
  id: string;
  name: string;
  family_id: string;
  dob?: string | null;
  student_email?: string | null;
}

/**
 * Family data extracted from enrollment joins
 */
export interface FamilyData {
  id: string;
  family_name: string;
  primary_contact_type?: string | null;
  father_name?: string | null;
  father_email?: string | null;
  mother_name?: string | null;
  mother_email?: string | null;
}

/**
 * Program data extracted from enrollment joins
 */
export interface ProgramData {
  id: string;
  name: string;
  payment_type: "one_time" | "recurring" | string;
  payment_frequency?: "monthly" | "quarterly" | "semester" | "annual" | string | null;
  tuition_amount: number;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
}

/**
 * Organization data extracted from enrollment joins
 */
export interface OrganizationData {
  slug?: string | null;
  timezone?: string | null;
  currency?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Enrollment data with nested relations for payment operations
 */
export interface EnrollmentWithRelations {
  id: string;
  organization_id: string;
  enrolled_date?: string | null;
  billing_anchor_date?: string | null;
  base_tuition: number;
  discount_amount?: number | null;
  discount_type?:
    | "sibling_discount"
    | "financial_aid"
    | "zakaat"
    | "staff_discount"
    | "other"
    | null;
  final_tuition: number;
  next_billing_date?: string | null;
  billing_method?: string | null;
  student_id?: string;
  family_id?: string;
}

/**
 * Catch-up line item for backdated enrollments
 */
export interface CatchupLineItem {
  description: string;
  amount: number; // in cents
  period_start: string;
  period_end: string;
}

/**
 * Context for payment link generation
 */
export interface PaymentLinkContext {
  organization_id: string;
  enrollment: EnrollmentWithRelations;
  student: StudentData;
  family: FamilyData;
  program: ProgramData;
  organization: OrganizationData;
  recipientEmail: string;
  recipientName: string;
  isStudentRecipient: boolean;
  customerId: string;
  baseUrl: string;
  successUrl: string;
  cancelUrl: string;
  orgTimezone: string;
}

/**
 * Context for refund operations
 */
export interface RefundContext {
  organization_id: string;
  payment: {
    id: string;
    organization_id: string;
    payment_source: "stripe" | "manual";
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    amount: number;
    status: string;
    notes?: string | null;
  };
  orgTimezone: string;
}

/**
 * Result of checkout session creation
 */
export interface CheckoutSessionResult {
  url: string | null;
  id: string;
  metadata?: Record<string, string>;
}

/**
 * Billing frequency type
 */
export type BillingFrequency = "monthly" | "quarterly" | "semester" | "annual";

/**
 * Payment method types
 */
export type PaymentMethod = "cash" | "check" | "zelle" | "card" | "bank_transfer" | string;

/**
 * Payment status types
 */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "cancelled";

/**
 * Payment source types
 */
export type PaymentSource = "stripe" | "manual";

/**
 * Extract nested data that may be array or object from Supabase joins
 */
export function extractNestedData<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] as T;
  return raw as T;
}
