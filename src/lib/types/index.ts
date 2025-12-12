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
  joinDate: string;
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

  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Payment
// -----------------------------------------------------------------------------

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

  // Stripe
  stripePaymentIntentId: string | null;

  // Manual payment info
  notes: string | null;
  recordedBy: string | null; // Admin who recorded manual payment

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
}

export interface PaymentFilters {
  search?: string;
  method?: PaymentMethod | 'all';
  type?: PaymentType | 'all';
  status?: PaymentStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}
