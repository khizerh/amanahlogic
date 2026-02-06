/**
 * Invoice Generator Tests
 *
 * Comprehensive tests for invoice number generation, period calculations,
 * date formatting, and metadata bundling for the recurring billing engine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock "server-only" before importing the module under test.
// The real package throws at import time in non-server contexts.
vi.mock("server-only", () => ({}));

// Mock the Supabase server client factory so we never touch a real DB.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  calculateNextBillingDate,
  formatPeriodLabel,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
  getMonthsForFrequency,
  calculatePeriodEnd,
  generateInvoiceNumber,
  generateInvoiceMetadata,
  generateAdHocInvoiceMetadata,
} from "../invoice-generator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock SupabaseClient whose `.from().select().eq().single()`
 * and `.rpc()` chains can be configured per-test.
 */
function createMockSupabase({
  orgName = "Amanah Logic",
  orgError = null as { message: string } | null,
  sequence = 1,
  sequenceError = null as { message: string } | null,
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: orgError ? null : { name: orgName },
    error: orgError,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({
    data: sequenceError ? null : sequence,
    error: sequenceError,
  });

  return { from, rpc, single, eq, select } as unknown as ReturnType<
    typeof createMockSupabase
  > & { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe("Invoice Generator", () => {
  // -----------------------------------------------------------------------
  // getMonthsForFrequency
  // -----------------------------------------------------------------------
  describe("getMonthsForFrequency", () => {
    it("should return 1 for monthly", () => {
      expect(getMonthsForFrequency("monthly")).toBe(1);
    });

    it("should return 6 for biannual", () => {
      expect(getMonthsForFrequency("biannual")).toBe(6);
    });

    it("should return 12 for annual", () => {
      expect(getMonthsForFrequency("annual")).toBe(12);
    });

    it("should default to 1 for unknown frequency", () => {
      // Cast to satisfy TS while testing the default branch
      expect(getMonthsForFrequency("quarterly" as never)).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // calculateNextBillingDate
  // -----------------------------------------------------------------------
  describe("calculateNextBillingDate", () => {
    it("should advance monthly: Jan 1 -> Feb 1", () => {
      const current = new Date(2025, 0, 1); // Jan 1 2025
      const next = calculateNextBillingDate(current, "monthly");
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(1);
    });

    it("should advance biannual: Jan 1 -> Jul 1", () => {
      const current = new Date(2025, 0, 1);
      const next = calculateNextBillingDate(current, "biannual");
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(6); // Jul
      expect(next.getDate()).toBe(1);
    });

    it("should advance annual: Jan 1 -> Jan 1 next year", () => {
      const current = new Date(2025, 0, 1);
      const next = calculateNextBillingDate(current, "annual");
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(0); // Jan
      expect(next.getDate()).toBe(1);
    });

    it("should clamp month-end: Jan 31 -> Feb 28 (non-leap year)", () => {
      const current = new Date(2025, 0, 31); // Jan 31
      const next = calculateNextBillingDate(current, "monthly");
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(28); // Feb has 28 days in 2025
    });

    it("should handle Dec -> Jan year rollover", () => {
      const current = new Date(2025, 11, 15); // Dec 15
      const next = calculateNextBillingDate(current, "monthly");
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(0); // Jan
      expect(next.getDate()).toBe(15);
    });

    it("should handle leap year: Jan 29 -> Feb 29 in leap year (2028)", () => {
      // 2028 is a leap year
      const current = new Date(2028, 0, 29); // Jan 29 2028
      const next = calculateNextBillingDate(current, "monthly");
      expect(next.getFullYear()).toBe(2028);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(29); // Feb 29 exists in 2028
    });

    it("should clamp Jan 31 -> Feb 28 in non-leap year (2025)", () => {
      const current = new Date(2025, 0, 31);
      const next = calculateNextBillingDate(current, "monthly");
      expect(next.getMonth()).toBe(1);
      expect(next.getDate()).toBe(28);
    });

    it("should handle biannual from Aug -> Feb with clamping", () => {
      // Aug 31 + 6 months = Feb; Feb 28 or 29 depending on year
      const current = new Date(2025, 7, 31); // Aug 31 2025
      const next = calculateNextBillingDate(current, "biannual");
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(28); // 2026 is not a leap year
    });

    it("should accept an optional timezone parameter without changing behavior", () => {
      const current = new Date(2025, 0, 1);
      const next = calculateNextBillingDate(current, "monthly", "America/New_York");
      expect(next.getMonth()).toBe(1);
      expect(next.getDate()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // formatPeriodLabel
  // -----------------------------------------------------------------------
  describe("formatPeriodLabel", () => {
    it("should format monthly as full month and year", () => {
      const start = new Date(2025, 0, 1); // Jan 1 2025
      expect(formatPeriodLabel(start, "monthly")).toBe("January 2025");
    });

    it("should format monthly for different months", () => {
      expect(formatPeriodLabel(new Date(2025, 5, 15), "monthly")).toBe("June 2025");
      expect(formatPeriodLabel(new Date(2025, 11, 1), "monthly")).toBe("December 2025");
    });

    it("should format biannual as abbreviated range within same year", () => {
      const start = new Date(2025, 0, 1); // Jan 1
      // Jan + 6 months = Jul, so label should be "Jan 2025 - Jul 2025"
      expect(formatPeriodLabel(start, "biannual")).toBe("Jan 2025 - Jul 2025");
    });

    it("should format biannual crossing year boundary", () => {
      const start = new Date(2025, 9, 1); // Oct 1 2025
      // Oct + 6 months = Apr 2026
      expect(formatPeriodLabel(start, "biannual")).toBe("Oct 2025 - Apr 2026");
    });

    it("should format annual as year range", () => {
      const start = new Date(2025, 0, 1);
      expect(formatPeriodLabel(start, "annual")).toBe("2025-2026");
    });

    it("should format annual for any start month", () => {
      const start = new Date(2025, 6, 15); // Jul 15 2025
      expect(formatPeriodLabel(start, "annual")).toBe("2025-2026");
    });

    it("should default to monthly format for unknown frequency", () => {
      const start = new Date(2025, 3, 1); // Apr 1
      expect(formatPeriodLabel(start, "weekly" as never)).toBe("April 2025");
    });
  });

  // -----------------------------------------------------------------------
  // parseDateInOrgTimezone
  // -----------------------------------------------------------------------
  describe("parseDateInOrgTimezone", () => {
    it("should parse a YYYY-MM-DD string correctly", () => {
      const result = parseDateInOrgTimezone("2025-01-15", "America/New_York");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it("should create a local Date object (not UTC-shifted)", () => {
      const result = parseDateInOrgTimezone("2025-06-30", "America/Los_Angeles");
      // When constructed with new Date(year, month, day), hours default to 00:00 local
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("should parse the first day of a month", () => {
      const result = parseDateInOrgTimezone("2025-03-01", "UTC");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(1);
    });

    it("should parse the last day of a month", () => {
      const result = parseDateInOrgTimezone("2025-12-31", "America/Chicago");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(31);
    });

    it("should parse a leap day", () => {
      const result = parseDateInOrgTimezone("2028-02-29", "America/New_York");
      expect(result.getFullYear()).toBe(2028);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(29);
    });
  });

  // -----------------------------------------------------------------------
  // getTodayInOrgTimezone
  // -----------------------------------------------------------------------
  describe("getTodayInOrgTimezone", () => {
    it("should return a string in YYYY-MM-DD format", () => {
      const result = getTodayInOrgTimezone("America/New_York");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return a valid date string", () => {
      const result = getTodayInOrgTimezone("America/Los_Angeles");
      const [year, month, day] = result.split("-").map(Number);
      expect(year).toBeGreaterThanOrEqual(2025);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
    });

    it("should work with different timezones", () => {
      // All should return valid date strings; the actual date may differ
      // depending on when the test runs (e.g., near midnight).
      const nyResult = getTodayInOrgTimezone("America/New_York");
      const laResult = getTodayInOrgTimezone("America/Los_Angeles");
      const tokyoResult = getTodayInOrgTimezone("Asia/Tokyo");

      expect(nyResult).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(laResult).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tokyoResult).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // -----------------------------------------------------------------------
  // calculatePeriodEnd
  // -----------------------------------------------------------------------
  describe("calculatePeriodEnd", () => {
    it("should return Jan 31 for monthly period starting Jan 1", () => {
      const start = new Date(2025, 0, 1); // Jan 1
      const end = calculatePeriodEnd(start, "monthly");
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(0); // Still January
      expect(end.getDate()).toBe(31);
    });

    it("should return Jun 30 for biannual period starting Jan 1", () => {
      const start = new Date(2025, 0, 1);
      const end = calculatePeriodEnd(start, "biannual");
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(5); // June
      expect(end.getDate()).toBe(30);
    });

    it("should return Dec 31 for annual period starting Jan 1", () => {
      const start = new Date(2025, 0, 1);
      const end = calculatePeriodEnd(start, "annual");
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(11); // December
      expect(end.getDate()).toBe(31);
    });

    it("should handle Feb period end in leap year", () => {
      // Monthly from Feb 1 2028 (leap year) -> period end is Feb 29
      const start = new Date(2028, 1, 1); // Feb 1 2028
      const end = calculatePeriodEnd(start, "monthly");
      expect(end.getFullYear()).toBe(2028);
      expect(end.getMonth()).toBe(1); // Feb
      expect(end.getDate()).toBe(29);
    });

    it("should handle Feb period end in non-leap year", () => {
      const start = new Date(2025, 1, 1); // Feb 1 2025
      const end = calculatePeriodEnd(start, "monthly");
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(1); // Feb
      expect(end.getDate()).toBe(28);
    });

    it("should handle period starting mid-month", () => {
      const start = new Date(2025, 0, 15); // Jan 15
      const end = calculatePeriodEnd(start, "monthly");
      // Next period starts Feb 15, so end is Feb 14
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(1); // Feb
      expect(end.getDate()).toBe(14);
    });

    it("should handle biannual crossing year boundary", () => {
      const start = new Date(2025, 9, 1); // Oct 1 2025
      const end = calculatePeriodEnd(start, "biannual");
      // Next period starts Apr 1 2026, so end is Mar 31 2026
      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(2); // March
      expect(end.getDate()).toBe(31);
    });
  });

  // -----------------------------------------------------------------------
  // generateInvoiceNumber (async, mocked Supabase)
  // -----------------------------------------------------------------------
  describe("generateInvoiceNumber", () => {
    it("should generate correct format: INV-{CODE}-{YYYYMM}-{SEQ}", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-123",
        new Date(2025, 0, 15),
        supabase as never,
      );
      expect(result).toBe("INV-AL-202501-0001");
    });

    it("should pad the sequence number to 4 digits", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 42 });
      const result = await generateInvoiceNumber(
        "org-123",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toBe("INV-AL-202501-0042");
    });

    it("should handle large sequence numbers", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 9999 });
      const result = await generateInvoiceNumber(
        "org-123",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toBe("INV-AL-202501-9999");
    });

    it("should use the billing date month and year", async () => {
      const supabase = createMockSupabase({ orgName: "Test Org", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-123",
        new Date(2026, 11, 25), // Dec 2026
        supabase as never,
      );
      expect(result).toBe("INV-TO-202612-0001");
    });

    it("should pass correct arguments to supabase from() chain", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });
      await generateInvoiceNumber("org-abc", new Date(2025, 5, 1), supabase as never);

      expect(supabase.from).toHaveBeenCalledWith("organizations");
      expect(supabase.rpc).toHaveBeenCalledWith("next_invoice_sequence", {
        p_organization_id: "org-abc",
        p_year_month: "202506",
      });
    });

    it("should throw when organization lookup fails", async () => {
      const supabase = createMockSupabase({
        orgError: { message: "Not found" },
      });

      await expect(
        generateInvoiceNumber("org-bad", new Date(2025, 0, 1), supabase as never),
      ).rejects.toThrow("Failed to get organization: Not found");
    });

    it("should throw when sequence RPC fails", async () => {
      const supabase = createMockSupabase({
        orgName: "Amanah Logic",
        sequenceError: { message: "RPC error" },
      });

      await expect(
        generateInvoiceNumber("org-123", new Date(2025, 0, 1), supabase as never),
      ).rejects.toThrow("Failed to reserve invoice number: RPC error");
    });

    // --- extractOrgCode tested indirectly via generateInvoiceNumber ---

    it("should extract code from two-word name: 'Amanah Logic' -> AL", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-1",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toContain("INV-AL-");
    });

    it("should strip 'Islamic Center' prefix: 'Islamic Center of Fremont' -> OF", async () => {
      const supabase = createMockSupabase({
        orgName: "Islamic Center of Fremont",
        sequence: 1,
      });
      const result = await generateInvoiceNumber(
        "org-2",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toContain("INV-OF-");
    });

    it("should strip 'Islamic Centre' prefix: 'Islamic Centre Toronto' -> TO", async () => {
      const supabase = createMockSupabase({
        orgName: "Islamic Centre Toronto",
        sequence: 1,
      });
      const result = await generateInvoiceNumber(
        "org-3",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toContain("INV-TO-");
    });

    it("should strip 'IC' prefix: 'IC Silicon Valley' -> SV", async () => {
      const supabase = createMockSupabase({
        orgName: "IC Silicon Valley",
        sequence: 1,
      });
      const result = await generateInvoiceNumber(
        "org-4",
        new Date(2025, 0, 1),
        supabase as never,
      );
      // "IC" prefix stripped -> "Silicon Valley" -> first letters = "SV"
      expect(result).toContain("INV-SV-");
    });

    it("should handle single-word name using first two letters", async () => {
      const supabase = createMockSupabase({ orgName: "Masjid", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-5",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toContain("INV-MA-");
    });

    it("should handle hyphenated names: 'Al-Nur Masjid' -> AN", async () => {
      const supabase = createMockSupabase({ orgName: "Al-Nur Masjid", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-6",
        new Date(2025, 0, 1),
        supabase as never,
      );
      // "Al-Nur Masjid" splits on [\s-]+ into ["Al", "Nur", "Masjid"]
      // First two words: "Al" and "Nur" -> "AN"
      expect(result).toContain("INV-AN-");
    });

    it("should uppercase the org code", async () => {
      const supabase = createMockSupabase({ orgName: "lowercase org", sequence: 1 });
      const result = await generateInvoiceNumber(
        "org-7",
        new Date(2025, 0, 1),
        supabase as never,
      );
      expect(result).toContain("INV-LO-");
    });
  });

  // -----------------------------------------------------------------------
  // generateInvoiceMetadata (async, mocked Supabase)
  // -----------------------------------------------------------------------
  describe("generateInvoiceMetadata", () => {
    it("should return a complete metadata bundle for monthly billing", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateInvoiceMetadata(
        "org-123",
        "2025-01-15",
        "monthly",
        "America/New_York",
        supabase as never,
      );

      expect(metadata.invoiceNumber).toBe("INV-AL-202501-0001");
      expect(metadata.dueDate).toBe("2025-01-15");
      expect(metadata.periodStart).toBe("2025-01-15");
      // Monthly: Jan 15 + 1 month = Feb 15, minus 1 day = Feb 14
      expect(metadata.periodEnd).toBe("2025-02-14");
      expect(metadata.periodLabel).toBe("January 2025");
      expect(metadata.monthsCredited).toBe(1);
    });

    it("should return correct metadata for biannual billing", async () => {
      const supabase = createMockSupabase({ orgName: "Test Org", sequence: 3 });

      const metadata = await generateInvoiceMetadata(
        "org-456",
        "2025-01-01",
        "biannual",
        "America/Los_Angeles",
        supabase as never,
      );

      expect(metadata.invoiceNumber).toBe("INV-TO-202501-0003");
      expect(metadata.dueDate).toBe("2025-01-01");
      expect(metadata.periodStart).toBe("2025-01-01");
      expect(metadata.periodEnd).toBe("2025-06-30");
      expect(metadata.periodLabel).toBe("Jan 2025 - Jul 2025");
      expect(metadata.monthsCredited).toBe(6);
    });

    it("should return correct metadata for annual billing", async () => {
      const supabase = createMockSupabase({ orgName: "Big Academy", sequence: 1 });

      const metadata = await generateInvoiceMetadata(
        "org-789",
        "2025-01-01",
        "annual",
        "America/Chicago",
        supabase as never,
      );

      expect(metadata.invoiceNumber).toBe("INV-BA-202501-0001");
      expect(metadata.dueDate).toBe("2025-01-01");
      expect(metadata.periodStart).toBe("2025-01-01");
      expect(metadata.periodEnd).toBe("2025-12-31");
      expect(metadata.periodLabel).toBe("2025-2026");
      expect(metadata.monthsCredited).toBe(12);
    });

    it("should format dates as YYYY-MM-DD strings", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateInvoiceMetadata(
        "org-123",
        "2025-06-01",
        "monthly",
        "America/New_York",
        supabase as never,
      );

      expect(metadata.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(metadata.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(metadata.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // -----------------------------------------------------------------------
  // generateAdHocInvoiceMetadata (async, mocked Supabase)
  // -----------------------------------------------------------------------
  describe("generateAdHocInvoiceMetadata", () => {
    it("should use monthly label for 1 month credited", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 5 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-03-01",
        1,
        "America/New_York",
        supabase as never,
      );

      expect(metadata.invoiceNumber).toBe("INV-AL-202503-0005");
      expect(metadata.dueDate).toBe("2025-03-01");
      expect(metadata.periodStart).toBe("2025-03-01");
      expect(metadata.periodEnd).toBe("2025-03-31");
      expect(metadata.periodLabel).toBe("March 2025");
      expect(metadata.monthsCredited).toBe(1);
    });

    it("should use biannual label for 6 months credited", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-01-01",
        6,
        "America/New_York",
        supabase as never,
      );

      expect(metadata.periodLabel).toBe("Jan 2025 - Jul 2025");
      expect(metadata.monthsCredited).toBe(6);
    });

    it("should use annual label for 12 months credited", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-01-01",
        12,
        "America/New_York",
        supabase as never,
      );

      expect(metadata.periodLabel).toBe("2025-2026");
      expect(metadata.monthsCredited).toBe(12);
    });

    it("should generate custom period label for non-standard month counts within same year", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-03-01",
        3,
        "America/New_York",
        supabase as never,
      );

      // 3 months from Mar 1 => Jun 1, period end = May 31
      // Same year => "Mar - May 2025"
      expect(metadata.periodStart).toBe("2025-03-01");
      expect(metadata.periodEnd).toBe("2025-05-31");
      expect(metadata.monthsCredited).toBe(3);
      // Same year format: "{startMonth} - {endMonth} {year}"
      expect(metadata.periodLabel).toMatch(/Mar.*May.*2025/);
    });

    it("should generate custom period label crossing year boundary", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-10-01",
        8,
        "America/New_York",
        supabase as never,
      );

      // 8 months from Oct 1 2025 => Jun 1 2026, period end = May 31 2026
      expect(metadata.periodStart).toBe("2025-10-01");
      expect(metadata.periodEnd).toBe("2026-05-31");
      expect(metadata.monthsCredited).toBe(8);
      // Cross-year format: "{startMonth} {startYear} - {endMonth} {endYear}"
      expect(metadata.periodLabel).toMatch(/Oct.*2025.*May.*2026/);
    });

    it("should calculate period end correctly for 2 months", async () => {
      const supabase = createMockSupabase({ orgName: "Test Org", sequence: 1 });

      const metadata = await generateAdHocInvoiceMetadata(
        "org-123",
        "2025-01-15",
        2,
        "America/New_York",
        supabase as never,
      );

      // 2 months from Jan 15 => Mar 15, period end = Mar 14
      expect(metadata.periodStart).toBe("2025-01-15");
      expect(metadata.periodEnd).toBe("2025-03-14");
      expect(metadata.monthsCredited).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Integration / edge case scenarios
  // -----------------------------------------------------------------------
  describe("Integration scenarios", () => {
    it("should produce consistent period start/end with calculatePeriodEnd and metadata", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateInvoiceMetadata(
        "org-123",
        "2025-01-01",
        "monthly",
        "America/New_York",
        supabase as never,
      );

      // Verify the metadata period end matches what calculatePeriodEnd returns
      const start = parseDateInOrgTimezone("2025-01-01", "America/New_York");
      const end = calculatePeriodEnd(start, "monthly");
      expect(metadata.periodEnd).toBe(end.toISOString().split("T")[0]);
    });

    it("should handle end-of-month billing date through full metadata generation", async () => {
      const supabase = createMockSupabase({ orgName: "Amanah Logic", sequence: 1 });

      const metadata = await generateInvoiceMetadata(
        "org-123",
        "2025-01-31",
        "monthly",
        "America/New_York",
        supabase as never,
      );

      // Jan 31 + 1 month = Feb 28 (clamped), period end = Feb 27
      expect(metadata.periodStart).toBe("2025-01-31");
      expect(metadata.periodEnd).toBe("2025-02-27");
    });

    it("should chain calculateNextBillingDate and calculatePeriodEnd correctly", () => {
      const current = new Date(2025, 0, 1);

      // Monthly cycle
      const nextBilling = calculateNextBillingDate(current, "monthly");
      const periodEnd = calculatePeriodEnd(current, "monthly");

      // Period end should be exactly one day before the next billing date
      const dayBeforeNextBilling = new Date(nextBilling);
      dayBeforeNextBilling.setDate(dayBeforeNextBilling.getDate() - 1);

      expect(periodEnd.getTime()).toBe(dayBeforeNextBilling.getTime());
    });

    it("should chain calculateNextBillingDate and calculatePeriodEnd for biannual", () => {
      const current = new Date(2025, 0, 1);
      const nextBilling = calculateNextBillingDate(current, "biannual");
      const periodEnd = calculatePeriodEnd(current, "biannual");

      const dayBeforeNextBilling = new Date(nextBilling);
      dayBeforeNextBilling.setDate(dayBeforeNextBilling.getDate() - 1);

      expect(periodEnd.getTime()).toBe(dayBeforeNextBilling.getTime());
    });

    it("should chain calculateNextBillingDate and calculatePeriodEnd for annual", () => {
      const current = new Date(2025, 0, 1);
      const nextBilling = calculateNextBillingDate(current, "annual");
      const periodEnd = calculatePeriodEnd(current, "annual");

      const dayBeforeNextBilling = new Date(nextBilling);
      dayBeforeNextBilling.setDate(dayBeforeNextBilling.getDate() - 1);

      expect(periodEnd.getTime()).toBe(dayBeforeNextBilling.getTime());
    });

    it("should roundtrip parse -> format -> parse for dates", () => {
      const dateStr = "2025-07-15";
      const parsed = parseDateInOrgTimezone(dateStr, "America/New_York");
      const reformatted = parsed.toISOString().split("T")[0];
      // Local date components should survive the round trip
      expect(reformatted).toBe(dateStr);
    });
  });
});
