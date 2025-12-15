/**
 * Mock Billing Service
 *
 * In-memory billing operations for UI development.
 * Implements the same business logic as the real billing engine
 * but operates on the mock data arrays directly.
 *
 * Key business rules:
 * - paidMonths tracks progress toward eligibility (60 months)
 * - Status transitions: waiting_period -> active (at 60 months)
 * - Status transitions: active/waiting_period -> lapsed (7+ days overdue)
 * - Monthly = +1 month, Biannual = +6 months, Annual = +12 months
 */

import {
  mockPayments,
  mockMemberships,
  mockMembers,
  mockPlans,
} from './index';
import type {
  Payment,
  Membership,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  MembershipStatus,
  BillingFrequency,
} from '@/lib/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RecordPaymentInput {
  memberId: string;
  membershipId: string;
  planId: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  monthsCredited: number;
  checkNumber?: string;
  zelleTransactionId?: string;
  notes?: string;
  recordedBy?: string;
}

export interface RecordPaymentResult {
  success: boolean;
  payment?: Payment;
  membership?: Membership;
  statusChanged?: boolean;
  previousStatus?: MembershipStatus;
  newStatus?: MembershipStatus;
  error?: string;
}

export interface BillingCalculation {
  monthsCredited: number;
  newPaidMonths: number;
  newStatus: MembershipStatus;
  statusChanged: boolean;
  nextPaymentDue: string;
  eligibleDate: string | null;
}

// -----------------------------------------------------------------------------
// ID Generation
// -----------------------------------------------------------------------------

let paymentCounter = mockPayments.length + 1;

function generatePaymentId(): string {
  const id = `pay_${String(paymentCounter).padStart(4, '0')}`;
  paymentCounter++;
  return id;
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------

function formatDateString(date: Date): string {
  return date.toISOString();
}

function calculateNextPaymentDue(
  currentDate: Date,
  billingFrequency: BillingFrequency,
  billingAnniversaryDay: number
): string {
  const nextDate = new Date(currentDate);

  // Move to next billing cycle
  switch (billingFrequency) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'biannual':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'annual':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  // Adjust to billing anniversary day
  const lastDayOfMonth = new Date(
    nextDate.getFullYear(),
    nextDate.getMonth() + 1,
    0
  ).getDate();
  nextDate.setDate(Math.min(billingAnniversaryDay, lastDayOfMonth));

  return nextDate.toISOString();
}

// -----------------------------------------------------------------------------
// Status Transition Logic
// -----------------------------------------------------------------------------

/**
 * Determine new membership status based on paid months
 *
 * Business rules:
 * - 60+ paid months AND currently in waiting_period -> active
 * - Already active -> stays active
 * - Enrollment fee not paid -> stays pending/awaiting_signature
 */
function calculateNewStatus(
  currentStatus: MembershipStatus,
  newPaidMonths: number,
  enrollmentFeePaid: boolean
): MembershipStatus {
  // Can't progress without enrollment fee
  if (!enrollmentFeePaid) {
    return currentStatus;
  }

  // Main eligibility threshold: 60 months
  if (newPaidMonths >= 60 && currentStatus === 'waiting_period') {
    return 'active';
  }

  // If lapsed but now making payments, reinstate to appropriate status
  if (currentStatus === 'lapsed') {
    if (newPaidMonths >= 60) {
      return 'active';
    }
    return 'waiting_period';
  }

  // Keep current status otherwise
  return currentStatus;
}

/**
 * Calculate months credited based on billing frequency
 */
export function getMonthsForFrequency(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 1;
    case 'biannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

// -----------------------------------------------------------------------------
// Core Billing Operations
// -----------------------------------------------------------------------------

/**
 * Record a payment and update membership accordingly
 *
 * This is the main function called from the UI when recording manual payments.
 * It handles:
 * - Creating the payment record
 * - Updating paid months on the membership
 * - Handling enrollment fee payments
 * - Status transitions (waiting_period -> active)
 * - Updating next payment due date
 */
export function recordPayment(input: RecordPaymentInput): RecordPaymentResult {
  const {
    memberId,
    membershipId,
    planId,
    type,
    method,
    amount,
    monthsCredited,
    checkNumber,
    zelleTransactionId,
    notes,
    recordedBy = 'Admin User',
  } = input;

  // Find the membership
  const membershipIndex = mockMemberships.findIndex((m) => m.id === membershipId);
  if (membershipIndex === -1) {
    return { success: false, error: 'Membership not found' };
  }

  const membership = mockMemberships[membershipIndex];
  const member = mockMembers.find((m) => m.id === memberId);
  const plan = mockPlans.find((p) => p.id === planId);

  if (!member || !plan) {
    return { success: false, error: 'Member or plan not found' };
  }

  const now = new Date();
  const nowStr = formatDateString(now);

  // Create payment record
  const isManualPayment = ['cash', 'check', 'zelle'].includes(method);
  const payment: Payment = {
    id: generatePaymentId(),
    organizationId: membership.organizationId,
    membershipId,
    memberId,
    type,
    method,
    status: 'completed' as PaymentStatus,
    amount,
    stripeFee: 0, // Manual payments have no Stripe fee
    platformFee: 1.0, // Fixed platform fee
    totalCharged: amount,
    netAmount: amount - 1.0,
    monthsCredited,
    stripePaymentIntentId: null,
    checkNumber: method === 'check' ? (checkNumber || null) : null,
    zelleTransactionId: method === 'zelle' ? (zelleTransactionId || null) : null,
    notes: notes || (isManualPayment ? `${method} payment recorded` : null),
    recordedBy: isManualPayment ? recordedBy : null,
    createdAt: nowStr,
    paidAt: nowStr,
    refundedAt: null,
  };

  // Calculate membership updates
  const previousStatus = membership.status;
  let newPaidMonths = membership.paidMonths;
  let enrollmentFeePaid = membership.enrollmentFeePaid;
  let eligibleDate = membership.eligibleDate;

  if (type === 'enrollment_fee') {
    // Enrollment fee payment
    enrollmentFeePaid = true;
  } else {
    // Dues payment - credit months
    newPaidMonths = membership.paidMonths + monthsCredited;
  }

  // Determine new status
  const newStatus = calculateNewStatus(previousStatus, newPaidMonths, enrollmentFeePaid);
  const statusChanged = newStatus !== previousStatus;

  // Set eligible date if just became eligible
  if (newPaidMonths >= 60 && !eligibleDate) {
    eligibleDate = nowStr;
  }

  // Calculate next payment due
  const nextPaymentDue = calculateNextPaymentDue(
    now,
    membership.billingFrequency,
    membership.billingAnniversaryDay
  );

  // Update membership in place
  const updatedMembership: Membership = {
    ...membership,
    paidMonths: newPaidMonths,
    enrollmentFeePaid,
    lastPaymentDate: nowStr,
    nextPaymentDue,
    eligibleDate,
    status: newStatus,
    updatedAt: nowStr,
  };

  // Apply updates to mock data arrays
  mockMemberships[membershipIndex] = updatedMembership;
  mockPayments.unshift(payment); // Add to beginning (most recent first)

  return {
    success: true,
    payment,
    membership: updatedMembership,
    statusChanged,
    previousStatus,
    newStatus,
  };
}

/**
 * Calculate billing details for a potential payment
 *
 * Used by UI to preview what a payment would do before confirming.
 */
export function previewPayment(
  membershipId: string,
  type: PaymentType,
  monthsCredited: number
): BillingCalculation | null {
  const membership = mockMemberships.find((m) => m.id === membershipId);
  if (!membership) return null;

  const now = new Date();
  let newPaidMonths = membership.paidMonths;
  let enrollmentFeePaid = membership.enrollmentFeePaid;

  if (type === 'enrollment_fee') {
    enrollmentFeePaid = true;
  } else {
    newPaidMonths = membership.paidMonths + monthsCredited;
  }

  const newStatus = calculateNewStatus(
    membership.status,
    newPaidMonths,
    enrollmentFeePaid
  );
  const statusChanged = newStatus !== membership.status;

  const nextPaymentDue = calculateNextPaymentDue(
    now,
    membership.billingFrequency,
    membership.billingAnniversaryDay
  );

  const eligibleDate =
    newPaidMonths >= 60 && !membership.eligibleDate
      ? formatDateString(now)
      : membership.eligibleDate;

  return {
    monthsCredited: type === 'enrollment_fee' ? 0 : monthsCredited,
    newPaidMonths,
    newStatus,
    statusChanged,
    nextPaymentDue,
    eligibleDate,
  };
}

/**
 * Get member's current billing summary
 */
export function getMemberBillingSummary(memberId: string) {
  const membership = mockMemberships.find((m) => m.memberId === memberId);
  if (!membership) return null;

  const plan = mockPlans.find((p) => p.id === membership.planId);
  if (!plan) return null;

  const payments = mockPayments.filter((p) => p.memberId === memberId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const monthsUntilEligible = Math.max(0, 60 - membership.paidMonths);
  const progressPercent = Math.min((membership.paidMonths / 60) * 100, 100);

  return {
    membership,
    plan,
    payments,
    totalPaid,
    monthsUntilEligible,
    progressPercent,
    isEligible: membership.paidMonths >= 60,
  };
}

/**
 * Check if a member has an overdue payment
 */
export function isPaymentOverdue(membershipId: string): boolean {
  const membership = mockMemberships.find((m) => m.id === membershipId);
  if (!membership || !membership.nextPaymentDue) return false;

  const now = new Date();
  const dueDate = new Date(membership.nextPaymentDue);

  return now > dueDate;
}

/**
 * Get days overdue for a membership
 */
export function getDaysOverdue(membershipId: string): number {
  const membership = mockMemberships.find((m) => m.id === membershipId);
  if (!membership || !membership.nextPaymentDue) return 0;

  const now = new Date();
  const dueDate = new Date(membership.nextPaymentDue);

  if (now <= dueDate) return 0;

  const diffTime = now.getTime() - dueDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Process status transitions for overdue memberships
 *
 * Business rules:
 * - 7+ days overdue: active/waiting_period -> lapsed
 * - This runs automatically but can be triggered manually
 */
export function processOverdueTransitions(): {
  processed: number;
  transitioned: string[];
} {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const transitioned: string[] = [];

  mockMemberships.forEach((membership, index) => {
    if (
      (membership.status === 'active' || membership.status === 'waiting_period') &&
      membership.nextPaymentDue
    ) {
      const dueDate = new Date(membership.nextPaymentDue);
      if (dueDate < sevenDaysAgo) {
        // Transition to lapsed
        mockMemberships[index] = {
          ...membership,
          status: 'lapsed',
          updatedAt: formatDateString(now),
        };
        transitioned.push(membership.id);
      }
    }
  });

  return {
    processed: mockMemberships.length,
    transitioned,
  };
}

/**
 * Reinstate a lapsed membership
 *
 * When a lapsed member makes a payment, this handles the reinstatement.
 * Called automatically by recordPayment when payment is made on lapsed membership.
 */
export function reinstateMembership(membershipId: string): boolean {
  const index = mockMemberships.findIndex((m) => m.id === membershipId);
  if (index === -1) return false;

  const membership = mockMemberships[index];
  if (membership.status !== 'lapsed') return false;

  const newStatus = membership.paidMonths >= 60 ? 'active' : 'waiting_period';

  mockMemberships[index] = {
    ...membership,
    status: newStatus,
    updatedAt: formatDateString(new Date()),
  };

  return true;
}

// -----------------------------------------------------------------------------
// Billing Frequency Management
// -----------------------------------------------------------------------------

export interface UpdateFrequencyInput {
  membershipId: string;
  newFrequency: BillingFrequency;
}

export interface UpdateFrequencyResult {
  success: boolean;
  membership?: Membership;
  previousFrequency?: BillingFrequency;
  newFrequency?: BillingFrequency;
  error?: string;
}

/**
 * Update a membership's billing frequency
 *
 * Business rules:
 * - Change takes effect immediately for manual payment members
 * - For members with recurring payments, this updates the local record (Stripe update would happen separately)
 * - Next payment due date is recalculated based on new frequency
 * - No proration - change simply applies to next payment
 */
export function updateBillingFrequency(input: UpdateFrequencyInput): UpdateFrequencyResult {
  const { membershipId, newFrequency } = input;

  const membershipIndex = mockMemberships.findIndex((m) => m.id === membershipId);
  if (membershipIndex === -1) {
    return { success: false, error: 'Membership not found' };
  }

  const membership = mockMemberships[membershipIndex];
  const previousFrequency = membership.billingFrequency;

  // No change needed
  if (previousFrequency === newFrequency) {
    return {
      success: true,
      membership,
      previousFrequency,
      newFrequency,
    };
  }

  const now = new Date();
  const nowStr = formatDateString(now);

  // Calculate new next payment due based on new frequency
  // Uses last payment date as the base, or current date if no payments yet
  const baseDate = membership.lastPaymentDate
    ? new Date(membership.lastPaymentDate)
    : now;

  const nextPaymentDue = calculateNextPaymentDue(
    baseDate,
    newFrequency,
    membership.billingAnniversaryDay
  );

  // Update membership
  const updatedMembership: Membership = {
    ...membership,
    billingFrequency: newFrequency,
    nextPaymentDue,
    updatedAt: nowStr,
  };

  // Apply update to mock data
  mockMemberships[membershipIndex] = updatedMembership;

  return {
    success: true,
    membership: updatedMembership,
    previousFrequency,
    newFrequency,
  };
}

/**
 * Get the amount for a given billing frequency and plan
 */
export function getAmountForFrequency(planId: string, frequency: BillingFrequency): number {
  const plan = mockPlans.find((p) => p.id === planId);
  if (!plan) return 0;

  switch (frequency) {
    case 'monthly':
      return plan.pricing.monthly;
    case 'biannual':
      return plan.pricing.biannual;
    case 'annual':
      return plan.pricing.annual;
    default:
      return plan.pricing.monthly;
  }
}
