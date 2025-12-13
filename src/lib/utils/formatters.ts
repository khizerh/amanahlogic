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
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

// Membership status labels
export function formatStatus(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    pending: "Pending",
    awaiting_signature: "Awaiting Signature",
    waiting_period: "Waiting Period",
    active: "Active",
    lapsed: "Lapsed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

// Membership status colors (for custom styling)
export function getStatusColor(status: MembershipStatus): string {
  const colors: Record<MembershipStatus, string> = {
    pending: "bg-gray-100 text-gray-800",
    awaiting_signature: "bg-yellow-100 text-yellow-800",
    waiting_period: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
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
    awaiting_signature: "warning",
    waiting_period: "info",
    active: "success",
    lapsed: "withdrawn",
    cancelled: "error",
  };
  return variants[status];
}

// Email template type labels
export function getEmailTemplateTypeLabel(type: EmailTemplateType | "custom"): string {
  const labels: Record<EmailTemplateType | "custom", string> = {
    welcome: "Welcome",
    payment_receipt: "Payment Receipt",
    payment_reminder: "Payment Reminder",
    payment_failed: "Payment Failed",
    overdue_notice: "Overdue Notice",
    eligibility_reached: "Eligibility Reached",
    agreement_sent: "Agreement Sent",
    agreement_signed: "Agreement Signed",
    membership_cancelled: "Membership Cancelled",
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

// Plan type labels
export function formatPlanType(type: "single" | "married" | "widow"): string {
  const labels: Record<string, string> = {
    single: "Single",
    married: "Married",
    widow: "Widow/Widower",
  };
  return labels[type] || type;
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
    card: "Credit/Debit Card",
    ach: "Bank Transfer (ACH)",
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
