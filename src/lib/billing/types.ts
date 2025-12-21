import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipStatus, PaymentMethod, PaymentStatus } from "@/lib/types";

/**
 * Billing Engine Types for Burial Benefits Membership System
 *
 * Type definitions for recurring billing operations adapted from imarah.
 * Focused on membership dues tracking and eligibility management.
 */

/**
 * Result of a billing run for a single organization
 */
export interface BillingRunResult {
  /** Whether the billing run completed successfully (no errors) */
  success: boolean;
  /** Number of payment records created during this run */
  paymentsCreated: number;
  /** Array of payment IDs created */
  paymentIds: string[];
  /** Number of memberships skipped (due to Stripe, duplicates, etc.) */
  skipped: number;
  /** Array of errors encountered during processing */
  errors: Array<{ membership_id: string; error: string }>;
  /** ISO timestamp when the billing run completed */
  timestamp: string;
}

/**
 * Options for controlling billing run behavior
 */
export interface BillingOptions {
  /** If true, simulate the billing run without creating any records */
  dryRun?: boolean;
  /** Override the billing date for testing (ISO string: YYYY-MM-DD) */
  billingDate?: string;
  /** Enable extra verbose logging for debugging */
  debugMode?: boolean;
  /**
   * When true, skip the auto-status-update pass for lapsed memberships.
   * Primarily used by callers that already ran status updates in the same flow.
   */
  skipAutoStatusUpdate?: boolean;
  /** Supabase client to use (defaults to createClient() if not provided) */
  supabase?: SupabaseClient;
}

/**
 * Membership record ready for billing processing
 */
export interface MembershipToBill {
  id: string;
  organizationId: string;
  memberId: string;
  planId: string;
  status: MembershipStatus;
  billingFrequency: "monthly" | "biannual" | "annual";
  billingAnniversaryDay: number;
  paidMonths: number;
  nextPaymentDue: string;
  enrollmentFeePaid: boolean;

  // Related data for billing
  plan: {
    name: string;
    type: string;
    pricing: {
      monthly: number;
      biannual: number;
      annual: number;
    };
    enrollmentFee: number;
  };
  member: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

/**
 * Data required to create a new payment record
 */
export interface PaymentCreationData {
  organizationId: string;
  membershipId: string;
  memberId: string;
  amount: number;
  type: "enrollment_fee" | "dues" | "back_dues";
  method: PaymentMethod;
  status: PaymentStatus;
  monthsCredited: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  dueDate: string;
  notes?: string;
}

/**
 * Extended payment data with nested relations for display/processing
 */
export interface PaymentWithDetails {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;
  type: "enrollment_fee" | "dues" | "back_dues";
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  stripeFee: number;
  platformFee: number;
  totalCharged: number;
  netAmount: number;
  monthsCredited: number;
  stripePaymentIntentId: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;

  // Nested relations
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  membership: {
    id: string;
    status: MembershipStatus;
    paidMonths: number;
    billingFrequency: "monthly" | "biannual" | "annual";
  };
  plan?: {
    id: string;
    name: string;
    type: string;
  };
}

/**
 * Payment statistics aggregated by organization
 */
export interface PaymentStats {
  totalCollected: number;
  totalNet: number;
  totalFees: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

/**
 * Membership eligibility tracking data
 */
export interface EligibilityTracker {
  membershipId: string;
  memberId: string;
  paidMonths: number;
  requiredMonths: number;
  remainingMonths: number;
  isEligible: boolean;
  estimatedEligibilityDate: string | null;
  status: MembershipStatus;
}

/**
 * Payment period information for dues billing
 */
export interface BillingPeriod {
  start: string;
  end: string;
  label: string;
  dueDate: string;
  monthsIncluded: number;
}

/**
 * Result of payment processing operations
 */
export interface PaymentProcessingResult {
  success: boolean;
  paymentId?: string;
  error?: string;
  updatedMembership?: {
    paidMonths: number;
    status: MembershipStatus;
    nextPaymentDue: string | null;
  };
}

/**
 * Filters for querying payments
 */
export interface PaymentFilters {
  membershipId?: string;
  memberId?: string;
  status?: PaymentStatus | "all";
  type?: "enrollment_fee" | "dues" | "back_dues" | "all";
  method?: PaymentMethod | "all";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/**
 * Input for creating a manual payment
 */
export interface ManualPaymentInput {
  organizationId: string;
  membershipId: string;
  memberId: string;
  amount: number;
  method: Exclude<PaymentMethod, "stripe">;
  type: "enrollment_fee" | "dues" | "back_dues";
  monthsCredited: number;
  notes?: string;
  recordedBy: string;
  paidAt: string;
}

/**
 * Input for updating a payment
 */
export interface UpdatePaymentInput {
  id: string;
  status?: PaymentStatus;
  notes?: string;
  paidAt?: string;
  refundedAt?: string;
}

/**
 * Billing reminder notification data
 */
export interface BillingReminderData {
  membershipId: string;
  memberId: string;
  memberEmail: string;
  memberName: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  planName: string;
  reminderType: "upcoming" | "overdue" | "lapsed";
}

/**
 * Late payment tracking
 */
export interface LatePaymentInfo {
  membershipId: string;
  memberId: string;
  lastPaymentDate: string | null;
  daysSinceLastPayment: number;
  missedPaymentsCount: number;
  totalAmountDue: number;
  suggestedAction: "send_reminder" | "mark_lapsed" | "mark_cancelled";
}

/**
 * Bulk billing operation result
 */
export interface BulkBillingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    membershipId: string;
    success: boolean;
    paymentId?: string;
    error?: string;
  }>;
}
