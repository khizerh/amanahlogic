// =============================================================================
// Core Entity Types for Burial Benefits Membership System
// =============================================================================

// -----------------------------------------------------------------------------
// Enums & Constants
// -----------------------------------------------------------------------------

export type MembershipStatus =
  | 'pending'           // Account created, onboarding incomplete
  | 'awaiting_signature' // Agreement sent, not yet signed
  | 'waiting_period'    // Signed + paying, under 60 paid months
  | 'active'            // 60+ paid months, current on payments
  | 'lapsed'            // Missed recent payment(s), in grace
  | 'cancelled';        // 24+ months unpaid, membership void

export type PlanType = 'single' | 'married' | 'widow';

export type BillingFrequency = 'monthly' | 'biannual' | 'annual';

export type PaymentMethod = 'card' | 'ach' | 'cash' | 'check' | 'zelle';

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
  stripeConnectId: string | null;
  stripeOnboarded: boolean;
  platformFee: number; // Fixed dollar amount per transaction
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
  email: string;
  phone: string;
  address: Address;

  // Household
  spouseName: string | null;
  children: Child[];

  // Emergency
  emergencyContact: EmergencyContact;

  // Communication preferences
  preferredLanguage: CommunicationLanguage;

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
// Payment Method (for auto-pay)
// -----------------------------------------------------------------------------

export type PaymentMethodType = 'card' | 'us_bank_account';

export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'past_due';

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
  enrollmentFeePaid: boolean;

  // Dates
  joinDate: string | null; // Set when agreement is signed (official join date)
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
  activeMembers: number;
  waitingPeriod: number;
  lapsed: number;
  cancelled: number;
  pending: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  approachingEligibility: number; // 55-59 months
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
  | 'overdue_notice'
  | 'eligibility_reached'
  | 'agreement_sent'
  | 'agreement_signed'
  | 'membership_cancelled';

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
  memberEmail: string;
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
// Auto-Pay Invite (Stripe Checkout Session Tracking)
// -----------------------------------------------------------------------------

export type AutoPayInviteStatus = 'pending' | 'completed' | 'expired' | 'canceled';

export interface AutoPayInvite {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;

  // Stripe
  stripeCheckoutSessionId: string | null;

  // Details
  plannedAmount: number; // Monthly amount at time of invite
  firstChargeDate: string | null; // When first recurring charge will occur

  // Status tracking
  status: AutoPayInviteStatus;
  sentAt: string;
  completedAt: string | null;
  expiredAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AutoPayInviteWithMember extends AutoPayInvite {
  member: Member;
  membership: Membership;
  plan: Plan;
}

// -----------------------------------------------------------------------------
// Overdue Payment (View Type)
// -----------------------------------------------------------------------------

export interface OverduePaymentInfo {
  id: string;
  membershipId: string;
  memberId: string;

  // Member info
  memberName: string;
  memberEmail: string;
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
