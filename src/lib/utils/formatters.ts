import type { MembershipStatus, EmailTemplateType, EmailStatus } from "@/lib/types";

/**
 * Formatting utilities for display values
 */

// Currency formatting
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Date formatting
export function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  // For YYYY-MM-DD date-only strings, parse as local date to avoid UTC timezone shift
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

// Membership status labels
export function formatStatus(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    pending: "Pending",
    current: "Current",
    lapsed: "Lapsed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

// Membership status colors (for custom styling)
export function getStatusColor(status: MembershipStatus): string {
  const colors: Record<MembershipStatus, string> = {
    pending: "bg-gray-100 text-gray-800",
    current: "bg-green-100 text-green-800",
    lapsed: "bg-orange-100 text-orange-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return colors[status];
}

// Badge variant for membership status
export type BadgeVariant = "success" | "info" | "warning" | "error" | "inactive" | "withdrawn";

export function getStatusVariant(status: MembershipStatus): BadgeVariant {
  const variants: Record<MembershipStatus, BadgeVariant> = {
    pending: "inactive",
    current: "success",
    lapsed: "withdrawn",
    cancelled: "error",
  };
  return variants[status];
}

// Eligibility threshold (months of paid dues required)
export const ELIGIBILITY_THRESHOLD_MONTHS = 60;

// Check if a member is eligible for burial benefits
export function isEligibleForBenefits(
  paidMonths: number,
  status: MembershipStatus
): boolean {
  return paidMonths >= ELIGIBILITY_THRESHOLD_MONTHS && status !== "cancelled";
}

// Get eligibility display info
export function getEligibilityInfo(
  paidMonths: number,
  status: MembershipStatus
): { eligible: boolean; monthsRemaining: number; label: string } {
  const eligible = isEligibleForBenefits(paidMonths, status);
  const monthsRemaining = Math.max(0, ELIGIBILITY_THRESHOLD_MONTHS - paidMonths);

  let label: string;
  if (status === "cancelled") {
    label = "Membership cancelled";
  } else if (eligible) {
    label = "Eligible for benefits";
  } else if (status === "pending") {
    label = "Complete onboarding";
  } else {
    label = `${monthsRemaining} month${monthsRemaining !== 1 ? "s" : ""} until eligible`;
  }

  return { eligible, monthsRemaining, label };
}

// Email template type labels
export function getEmailTemplateTypeLabel(type: EmailTemplateType | "custom"): string {
  const labels: Record<EmailTemplateType | "custom", string> = {
    welcome: "Welcome",
    payment_receipt: "Payment Receipt",
    payment_reminder: "Payment Reminder",
    payment_failed: "Payment Failed",
    payment_setup: "Payment Setup",
    overdue_notice: "Overdue Notice",
    eligibility_reached: "Eligibility Reached",
    agreement_sent: "Agreement Sent",
    agreement_signed: "Agreement Signed",
    membership_cancelled: "Membership Cancelled",
    portal_link: "Portal Link",
    member_invite: "Member Invite",
    custom: "Custom",
  };
  return labels[type];
}

// Email status badge variant
export function getEmailStatusVariant(status: EmailStatus): BadgeVariant {
  const variants: Record<EmailStatus, BadgeVariant> = {
    queued: "inactive",
    sent: "info",
    delivered: "success",
    failed: "error",
    bounced: "warning",
  };
  return variants[status];
}

// Plan type labels - supports dynamic plan types
export function formatPlanType(type: string): string {
  const labels: Record<string, string> = {
    single: "Single",
    married: "Married",
    widow: "Widow/Widower",
  };
  // Return predefined label or capitalize the type
  return labels[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
}

// Billing frequency labels
export function formatBillingFrequency(frequency: "monthly" | "biannual" | "annual"): string {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    biannual: "Bi-Annual",
    annual: "Annual",
  };
  return labels[frequency] || frequency;
}

// Payment method labels
export function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    stripe: "Stripe",
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
  };
  return labels[method] || method;
}

// Payment type labels
export function formatPaymentType(type: string): string {
  const labels: Record<string, string> = {
    enrollment_fee: "Enrollment Fee",
    dues: "Dues",
    back_dues: "Back Dues",
  };
  return labels[type] || type;
}

// Payment status labels
export function formatPaymentStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    completed: "Completed",
    failed: "Failed",
    refunded: "Refunded",
  };
  return labels[status] || status;
}
