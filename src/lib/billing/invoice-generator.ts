/**
 * Invoice Generator
 *
 * Handles invoice number generation, period calculations, and date formatting
 * for the recurring billing engine.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate unique invoice number: INV-{ORGCODE}-{YYYYMM}-{SEQ}
 *
 * @param organization_id - ID of the organization
 * @param billingDate - Date for the billing period
 * @param supabaseClient - Optional Supabase client (defaults to createClient())
 * @returns Generated invoice number
 *
 * @example
 * // Returns: "INV-AL-202501-0001"
 * await generateInvoiceNumber('org-123', new Date('2025-01-01'));
 */
export async function generateInvoiceNumber(
  organization_id: string,
  billingDate: Date,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const supabase = supabaseClient || (await createClient());

  // Get organization info for code generation
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organization_id)
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to get organization: ${orgError?.message}`);
  }

  // Generate 2-letter code from organization name
  const orgCode = extractOrgCode(org.name);

  // Format: YYYYMM
  const year = billingDate.getFullYear();
  const month = String(billingDate.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;

  // Atomically increment invoice counter for this organization + month
  const { data: sequence, error: sequenceError } = await supabase.rpc("next_invoice_sequence", {
    p_organization_id: organization_id,
    p_year_month: yearMonth,
  });

  if (sequenceError || typeof sequence !== "number") {
    throw new Error(
      `Failed to reserve invoice number: ${sequenceError?.message || "unknown error"}`
    );
  }

  const seqStr = String(sequence).padStart(4, "0");
  return `INV-${orgCode}-${yearMonth}-${seqStr}`;
}

/**
 * Extract 2-letter code from organization name
 *
 * @param name - Full organization name
 * @returns 2-letter uppercase code
 *
 * @example
 * extractOrgCode("Amanah Logic") // Returns: "AL"
 * extractOrgCode("Islamic Center of Fremont") // Returns: "IF"
 * extractOrgCode("Al-Nur Organization") // Returns: "AN"
 */
function extractOrgCode(name: string): string {
  // Remove common prefixes
  const cleaned = name
    .replace(/^(Organization|Islamic Center|IC|Islamic Centre)\s+/i, "")
    .trim();

  // Split into words
  const words = cleaned.split(/[\s-]+/).filter((w) => w.length > 0);

  if (words.length >= 2) {
    // Take first letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Fallback: first 2 letters
  return cleaned.substring(0, 2).toUpperCase();
}

/**
 * Calculate next billing date based on frequency
 *
 * @param current - Current billing date
 * @param frequency - Billing frequency (monthly, biannual, annual)
 * @param timezone - Organization timezone
 * @returns Next billing date
 *
 * @example
 * // Monthly: Jan 1 -> Feb 1
 * calculateNextBillingDate(new Date('2025-01-01'), 'monthly')
 *
 * // Biannual: Jan 1 -> Jul 1
 * calculateNextBillingDate(new Date('2025-01-01'), 'biannual')
 *
 * // Annual: Jan 1 -> Jan 1 next year
 * calculateNextBillingDate(new Date('2025-01-01'), 'annual')
 */
export function calculateNextBillingDate(
  current: Date,
  frequency: "monthly" | "biannual" | "annual",
  _timezone?: string
): Date {
  let monthsToAdd: number;

  switch (frequency) {
    case "monthly":
      monthsToAdd = 1;
      break;
    case "biannual":
      monthsToAdd = 6;
      break;
    case "annual":
      monthsToAdd = 12;
      break;
    default:
      // Unknown frequency - return same date (no change)
      return new Date(current);
  }

  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth();
  const currentDay = current.getDate();

  // Check if current date is the last day of its month
  const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isCurrentOnLastDay = currentDay === lastDayOfCurrentMonth;

  // Calculate target year and month
  const totalMonths = currentMonth + monthsToAdd;
  const nextYear = currentYear + Math.floor(totalMonths / 12);
  const nextMonth = totalMonths % 12;

  // Get last day of next month
  const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();

  let nextDay: number;
  if (isCurrentOnLastDay) {
    // Current is last day of month → next should be last day of target month
    nextDay = lastDayOfNextMonth;
  } else {
    // Preserve day number, or use last day if it doesn't exist
    nextDay = Math.min(currentDay, lastDayOfNextMonth);
  }

  return new Date(nextYear, nextMonth, nextDay);
}

/**
 * Format period label for display on invoices
 *
 * @param start - Period start date
 * @param frequency - Billing frequency
 * @returns Human-readable period label
 *
 * @example
 * formatPeriodLabel(new Date('2025-01-01'), 'monthly') // "January 2025"
 * formatPeriodLabel(new Date('2025-01-01'), 'biannual') // "Jan 2025 - Jun 2025"
 * formatPeriodLabel(new Date('2025-01-01'), 'annual') // "2025-2026"
 */
export function formatPeriodLabel(
  start: Date,
  frequency: "monthly" | "biannual" | "annual"
): string {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const month = monthNames[start.getMonth()];
  const year = start.getFullYear();

  switch (frequency) {
    case "monthly":
      return `${month} ${year}`;
    case "biannual": {
      const endMonth = new Date(start);
      endMonth.setMonth(endMonth.getMonth() + 6);
      const endMonthName = monthNames[endMonth.getMonth()].substring(0, 3);
      const endYear = endMonth.getFullYear();
      return `${month.substring(0, 3)} ${year} - ${endMonthName} ${endYear}`;
    }
    case "annual": {
      const nextYear = year + 1;
      return `${year}-${nextYear}`;
    }
    default:
      return `${month} ${year}`;
  }
}

/**
 * Get today's date in organization's timezone as YYYY-MM-DD string
 *
 * @param timezone - Organization timezone (e.g., "America/New_York")
 * @returns Today's date as YYYY-MM-DD string in org timezone
 *
 * @example
 * getTodayInOrgTimezone("America/New_York") // "2025-01-15"
 */
export function getTodayInOrgTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Parse a YYYY-MM-DD date string in organization's timezone
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timezone - Organization timezone
 * @returns Date object
 *
 * @example
 * parseDateInOrgTimezone("2025-01-15", "America/New_York")
 */
export function parseDateInOrgTimezone(dateString: string, _timezone: string): Date {
  // Note: timezone param reserved for future timezone-aware parsing
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// -----------------------------------------------------------------------------
// Invoice Metadata Bundle
// -----------------------------------------------------------------------------

export interface InvoiceMetadata {
  invoiceNumber: string;
  dueDate: string; // YYYY-MM-DD
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  periodLabel: string;
  monthsCredited: number;
}

/**
 * Get months credited for a billing frequency
 */
export function getMonthsForFrequency(frequency: "monthly" | "biannual" | "annual"): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "biannual":
      return 6;
    case "annual":
      return 12;
    default:
      return 1;
  }
}

/**
 * Calculate period end date from start and frequency
 */
export function calculatePeriodEnd(
  periodStart: Date,
  frequency: "monthly" | "biannual" | "annual"
): Date {
  const periodEnd = new Date(periodStart);
  switch (frequency) {
    case "monthly":
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
    case "biannual":
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      break;
    case "annual":
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
  }
  periodEnd.setDate(periodEnd.getDate() - 1); // End is day before next period starts
  return periodEnd;
}

/**
 * Generate complete invoice metadata for a payment
 *
 * Use this when creating payments (manual, webhook, or billing engine)
 * to ensure consistent invoice metadata across all paths.
 *
 * @param organizationId - ID of the organization
 * @param billingDate - Date the payment is due (typically next_payment_due or today)
 * @param frequency - Billing frequency for period calculation
 * @param orgTimezone - Organization timezone
 * @param supabase - Supabase client
 * @returns Complete invoice metadata bundle
 *
 * @example
 * const metadata = await generateInvoiceMetadata(
 *   'org-123',
 *   '2025-01-15',
 *   'monthly',
 *   'America/Los_Angeles',
 *   supabase
 * );
 * // Returns: { invoiceNumber: 'INV-AL-202501-0001', dueDate: '2025-01-15', ... }
 */
export async function generateInvoiceMetadata(
  organizationId: string,
  billingDate: string,
  frequency: "monthly" | "biannual" | "annual",
  orgTimezone: string,
  supabase: SupabaseClient
): Promise<InvoiceMetadata> {
  const periodStart = parseDateInOrgTimezone(billingDate, orgTimezone);
  const invoiceNumber = await generateInvoiceNumber(organizationId, periodStart, supabase);
  const periodEnd = calculatePeriodEnd(periodStart, frequency);
  const periodLabel = formatPeriodLabel(periodStart, frequency);
  const monthsCredited = getMonthsForFrequency(frequency);

  return {
    invoiceNumber,
    dueDate: billingDate,
    periodStart: periodStart.toISOString().split("T")[0],
    periodEnd: periodEnd.toISOString().split("T")[0],
    periodLabel,
    monthsCredited,
  };
}

/**
 * Generate invoice metadata for ad-hoc payments (back dues, custom amounts)
 *
 * Unlike regular billing, ad-hoc payments may cover multiple periods or
 * custom month counts. This generates appropriate metadata.
 *
 * @param organizationId - ID of the organization
 * @param billingDate - Date of the payment (typically today)
 * @param monthsCredited - Number of months this payment covers
 * @param orgTimezone - Organization timezone
 * @param supabase - Supabase client
 * @returns Invoice metadata with custom period
 */
export async function generateAdHocInvoiceMetadata(
  organizationId: string,
  billingDate: string,
  monthsCredited: number,
  orgTimezone: string,
  supabase: SupabaseClient
): Promise<InvoiceMetadata> {
  const periodStart = parseDateInOrgTimezone(billingDate, orgTimezone);
  const invoiceNumber = await generateInvoiceNumber(organizationId, periodStart, supabase);

  // Calculate period end based on months credited
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + monthsCredited);
  periodEnd.setDate(periodEnd.getDate() - 1);

  // Generate period label
  let periodLabel: string;
  if (monthsCredited === 1) {
    periodLabel = formatPeriodLabel(periodStart, "monthly");
  } else if (monthsCredited === 6) {
    periodLabel = formatPeriodLabel(periodStart, "biannual");
  } else if (monthsCredited === 12) {
    periodLabel = formatPeriodLabel(periodStart, "annual");
  } else {
    // Custom period
    const startMonth = periodStart.toLocaleDateString("en-US", { month: "short" });
    const startYear = periodStart.getFullYear();
    const endMonth = periodEnd.toLocaleDateString("en-US", { month: "short" });
    const endYear = periodEnd.getFullYear();
    periodLabel =
      startYear === endYear
        ? `${startMonth} - ${endMonth} ${startYear}`
        : `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }

  return {
    invoiceNumber,
    dueDate: billingDate,
    periodStart: periodStart.toISOString().split("T")[0],
    periodEnd: periodEnd.toISOString().split("T")[0],
    periodLabel,
    monthsCredited,
  };
}
