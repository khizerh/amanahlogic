// =============================================================================
// Core Entity Types for Burial Benefits Membership System
// =============================================================================

// -----------------------------------------------------------------------------
// Enums & Constants
// -----------------------------------------------------------------------------

export type MembershipStatus =
  | 'pending'           // Onboarding incomplete (missing agreement and/or first payment)
  | 'current'           // Payments up to date (good standing)
  | 'lapsed'            // Behind on payment(s), in grace period
  | 'cancelled';        // 24+ months unpaid, membership void

// Eligibility is separate from status:
// eligible = paidMonths >= 60 && status !== 'cancelled'

// Plan types are now dynamic per organization - no longer hardcoded
export type PlanType = string;

export type BillingFrequency = 'monthly' | 'biannual' | 'annual';

export type PaymentMethod = 'stripe' | 'cash' | 'check' | 'zelle';

export type PaymentType = 'enrollment_fee' | 'dues' | 'back_dues';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type CommunicationLanguage = 'en' | 'fa'; // English, Farsi

// -----------------------------------------------------------------------------
// Organization
// -----------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  address: Address;
  phone: string;
  email: string;
  timezone: string;
  stripeConnectId: string | null;
  stripeOnboarded: boolean;
  platformFee: number; // Fixed dollar amount per transaction
  passFeesToMember: boolean; // If true, gross-up charges so org receives full amount
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Address (reusable)
// -----------------------------------------------------------------------------

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// -----------------------------------------------------------------------------
// Member
// -----------------------------------------------------------------------------

export interface Child {
  id: string;
  name: string;
  dateOfBirth: string; // ISO date
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Member {
  id: string;
  organizationId: string;

  // Primary contact
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address: Address;

  // Household
  spouseName: string | null;
  children: Child[];

  // Emergency
  emergencyContact: EmergencyContact;

  // Communication preferences
  preferredLanguage: CommunicationLanguage;

  // Portal
  userId: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Plan
// -----------------------------------------------------------------------------

export interface PlanPricing {
  monthly: number;
  biannual: number;
  annual: number;
}

export interface Plan {
  id: string;
  organizationId: string;
  type: PlanType;
  name: string;
  description: string;
  pricing: PlanPricing;
  enrollmentFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Payment Method (for subscriptions)
// -----------------------------------------------------------------------------

export type PaymentMethodType = 'card' | 'us_bank_account';

export type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'canceled' | 'past_due';

export interface PaymentMethodDetails {
  type: PaymentMethodType;
  last4: string;
  brand?: string; // For cards: visa, mastercard, amex, etc.
  bankName?: string; // For bank accounts
  expiryMonth?: number; // For cards
  expiryYear?: number; // For cards
}

// -----------------------------------------------------------------------------
// Membership
// -----------------------------------------------------------------------------

export interface Membership {
  id: string;
  organizationId: string;
  memberId: string;
  planId: string;

  // Status
  status: MembershipStatus;

  // Billing
  billingFrequency: BillingFrequency;
  billingAnniversaryDay: number; // Day of month (1-28)

  // Tracking
  paidMonths: number;
  enrollmentFeeStatus: "unpaid" | "paid" | "waived";

  // Dates
  joinDate: string | null; // Set when BOTH agreement signed AND first payment completed
  lastPaymentDate: string | null;
  nextPaymentDue: string | null;
  eligibleDate: string | null; // Date they became/will become eligible
  cancelledDate: string | null;

  // Agreement
  agreementSignedAt: string | null;
  agreementId: string | null;

  // Auto-pay / Stripe Subscription
  autoPayEnabled: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  paymentMethod: PaymentMethodDetails | null;

  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Payment
// -----------------------------------------------------------------------------
/**
 * Payment record representing a dues invoice/payment.
 *
 * ## Expected DB Schema (snake_case columns):
 * - id, organization_id, membership_id, member_id
 * - type, method, status
 * - amount, stripe_fee, platform_fee, total_charged, net_amount
 * - months_credited
 * - invoice_number, due_date, period_start, period_end, period_label
 * - stripe_payment_intent_id, stripe_charge_id, stripe_invoice_id
 * - check_number, zelle_transaction_id
 * - notes, recorded_by
 * - reminder_count, reminder_sent_at, reminders_paused, requires_review
 * - created_at, paid_at, refunded_at, updated_at
 */
export interface Payment {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;

  // Payment details
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;

  // Amounts
  amount: number;          // Base amount
  stripeFee: number;       // Processing fee
  platformFee: number;     // Platform fee
  totalCharged: number;    // What member paid
  netAmount: number;       // What org receives

  // Credits
  monthsCredited: number;  // How many months this payment credits

  // Invoice metadata (for statements/reminders)
  invoiceNumber?: string | null;      // e.g., "INV-2025-0001"
  dueDate?: string | null;            // When payment is due (YYYY-MM-DD)
  periodStart?: string | null;        // Start of billing period (YYYY-MM-DD)
  periodEnd?: string | null;          // End of billing period (YYYY-MM-DD)
  periodLabel?: string | null;        // e.g., "January 2025" or "Q1 2025"

  // Stripe
  stripePaymentIntentId: string | null;

  // Manual payment info
  checkNumber: string | null;        // For check payments
  zelleTransactionId: string | null; // For Zelle payments
  notes: string | null;
  recordedBy: string | null; // Admin who recorded manual payment

  // Reminder tracking
  reminderCount?: number;             // Number of reminders sent (default: 0)
  reminderSentAt?: string | null;     // When last reminder was sent
  remindersPaused?: boolean;          // Admin paused reminders for this payment
  requiresReview?: boolean;           // Flagged for admin review (max reminders hit)

  // Dates
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

// -----------------------------------------------------------------------------
// Agreement (E-Sign)
// -----------------------------------------------------------------------------

export interface Agreement {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;

  // Document
  templateVersion: string;
  templateLanguage?: "en" | "fa";
  pdfUrl: string | null;

  // Signature capture
  signatureImageUrl: string | null;
  signedName: string | null;

  // Audit trail
  ipAddress: string | null;
  userAgent: string | null;
  consentChecked: boolean;

  // Dates
  sentAt: string;
  signedAt: string | null;

  createdAt: string;
}

// ----------------------------------------------------------------------------- 
// Agreement Template
// -----------------------------------------------------------------------------

export interface AgreementTemplate {
  id: string;
  organizationId: string;
  language: "en" | "fa";
  version: string;
  storagePath: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Joined/View Types (for UI convenience)
// -----------------------------------------------------------------------------

export interface MemberWithMembership extends Member {
  membership: Membership | null;
  plan: Plan | null;
}

export interface MembershipWithDetails extends Membership {
  member: Member;
  plan: Plan;
  recentPayments: Payment[];
}

export interface PaymentWithDetails extends Payment {
  member: Member;
  membership: Membership;
}

// -----------------------------------------------------------------------------
// Dashboard Stats
// -----------------------------------------------------------------------------

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;      // "current" status (payments up to date)
  eligibleMembers: number;    // 60+ paid months (eligible for benefits)
  lapsed: number;
  cancelled: number;
  pending: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  approachingEligibility: number; // 50-59 months
  overduePayments: number;
}

// -----------------------------------------------------------------------------
// Filter Types
// -----------------------------------------------------------------------------

export interface MemberFilters {
  search?: string;
  status?: MembershipStatus | 'all';
  planType?: PlanType | 'all';
  eligibility?: 'eligible' | 'approaching' | 'waiting' | 'all';
  /** Custom eligibility threshold (default 60). Used for eligibility filters. */
  eligibilityMonths?: number;
}

export interface PaymentFilters {
  search?: string;
  method?: PaymentMethod | 'all';
  type?: PaymentType | 'all';
  status?: PaymentStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}

// -----------------------------------------------------------------------------
// Email System
// -----------------------------------------------------------------------------

export type EmailTemplateType =
  | 'welcome'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'payment_failed'
  | 'payment_setup'
  | 'overdue_notice'
  | 'eligibility_reached'
  | 'agreement_sent'
  | 'agreement_signed'
  | 'membership_cancelled'
  | 'portal_link'
  | 'member_invite'
  | 'password_reset';

export type EmailStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';

export interface LocalizedContent {
  en: string;
  fa: string;
}

export interface EmailTemplate {
  id: string;
  organizationId: string;
  type: EmailTemplateType;
  name: string;
  description: string;
  subject: LocalizedContent;
  body: LocalizedContent;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  organizationId: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  templateType: EmailTemplateType | 'custom';

  to: string;
  subject: string;
  bodyPreview: string;
  language: CommunicationLanguage;

  status: EmailStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;

  resendId: string | null; // Resend message ID

  createdAt: string;
}

export interface EmailLogWithMember extends EmailLog {
  member: Member;
}

// -----------------------------------------------------------------------------
// Onboarding Invite (Initial Payment Tracking - Stripe or Manual)
// -----------------------------------------------------------------------------

export type OnboardingInviteStatus = 'pending' | 'completed' | 'expired' | 'canceled';

export type OnboardingPaymentMethod = 'stripe' | 'manual';

export interface OnboardingInvite {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;

  // Payment method
  paymentMethod: OnboardingPaymentMethod;

  // Stripe (null for manual)
  stripeCheckoutSessionId: string | null;
  stripeSetupIntentId: string | null;

  // Enrollment fee tracking
  enrollmentFeeAmount: number;        // $500 or 0 if waived
  includesEnrollmentFee: boolean;     // Whether enrollment fee is part of this
  enrollmentFeePaidAt: string | null; // When enrollment fee was paid

  // Dues tracking
  duesAmount: number;                 // First period dues amount
  billingFrequency: BillingFrequency | null;
  duesPaidAt: string | null;          // When first dues was paid

  // Legacy fields (keep for compatibility)
  plannedAmount: number;              // Monthly amount at time of invite
  firstChargeDate: string | null;     // When first recurring charge will occur

  // Status tracking
  status: OnboardingInviteStatus;
  sentAt: string;
  completedAt: string | null;
  expiredAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface OnboardingInviteWithMember extends OnboardingInvite {
  member: Member;
  membership: Membership;
  plan: Plan;
}

// Legacy type aliases for backward compatibility during migration
export type AutoPayInviteStatus = OnboardingInviteStatus;
export type AutoPayInvite = OnboardingInvite;
export type AutoPayInviteWithMember = OnboardingInviteWithMember;

// -----------------------------------------------------------------------------
// Overdue Payment (View Type)
// -----------------------------------------------------------------------------

export interface OverduePaymentInfo {
  id: string;
  membershipId: string;
  memberId: string;

  // Member info
  memberName: string;
  memberEmail: string | null;
  planName: string;

  // Payment info
  amountDue: number;
  dueDate: string;
  daysOverdue: number;

  // Status
  lastPaymentDate: string | null;
  paidMonths: number;
  membershipStatus: MembershipStatus;

  // Reminders
  reminderCount: number;
  lastReminderSent: string | null;
  remindersPaused: boolean;
}

// Aging bucket for overdue analysis
export interface AgingBucket {
  range: string; // e.g., "0-7 days", "8-30 days"
  count: number;
  totalAmount: number;
}

// -----------------------------------------------------------------------------
// Organization Settings (Billing Configuration)
// -----------------------------------------------------------------------------

export interface BillingConfig {
  // Lapse/Cancel windows
  lapseDays: number; // Days overdue before lapse (default: 7)
  cancelMonths: number; // Months unpaid before cancel (default: 24)

  // Reminder schedule
  reminderSchedule: number[]; // Days after due date to send reminders (default: [3, 7, 14])
  maxReminders: number; // Max reminders before flagging for review (default: 3)
  sendInvoiceReminders: boolean; // Whether to send automated reminders

  // Eligibility
  eligibilityMonths: number; // Months required for eligibility (default: 60)
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;

  // Billing configuration
  billing: BillingConfig;

  // Email settings
  sendWelcomeEmail: boolean;
  sendReceiptEmail: boolean;
  sendEligibilityEmail: boolean;

  // Agreement settings
  requireAgreementSignature: boolean;
  agreementTemplateVersion: string;

  createdAt: string;
  updatedAt: string;
}

// Default billing configuration
export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  lapseDays: 7,
  cancelMonths: 24,
  reminderSchedule: [3, 7, 14],
  maxReminders: 3,
  sendInvoiceReminders: true,
  eligibilityMonths: 60,
};
