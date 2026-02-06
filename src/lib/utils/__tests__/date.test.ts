/**
 * Date Utility Tests
 *
 * Comprehensive tests for date parsing, formatting, and age calculation functions.
 * These utilities handle locale-aware date display across US, GB, and CA markets
 * and avoid common timezone pitfalls with YYYY-MM-DD date strings.
 */

import { describe, it, expect } from "vitest";
import {
  formatShortDateWithLocale,
  formatMediumDateWithLocale,
  formatDateTimeWithLocale,
  formatNumericDateTimeWithLocale,
  formatFullDateWithLocale,
  formatDateWithLocale,
  parseLocalDate,
  calculateAge,
} from "../date";

describe("Date Utilities", () => {
  // ─── parseLocalDate ───────────────────────────────────────────────────────

  describe("parseLocalDate", () => {
    it("should parse a standard date string as local time", () => {
      const date = parseLocalDate("2025-01-15");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0); // January is 0-indexed
      expect(date.getDate()).toBe(15);
    });

    it("should parse a leap year date (2000-02-29)", () => {
      const date = parseLocalDate("2000-02-29");
      expect(date.getFullYear()).toBe(2000);
      expect(date.getMonth()).toBe(1); // February
      expect(date.getDate()).toBe(29);
    });

    it("should parse year-end date (2025-12-31)", () => {
      const date = parseLocalDate("2025-12-31");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(11); // December
      expect(date.getDate()).toBe(31);
    });

    it("should parse the first day of the year", () => {
      const date = parseLocalDate("2025-01-01");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(1);
    });

    it("should use local midnight, not UTC", () => {
      // The key difference from new Date("2025-01-01") which parses as UTC midnight
      const date = parseLocalDate("2025-01-01");
      expect(date.getHours()).toBe(0); // Local midnight
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });
  });

  // ─── calculateAge ─────────────────────────────────────────────────────────

  describe("calculateAge", () => {
    it("should calculate age for a date far in the past", () => {
      // Person born in 1980 is at least 45 as of 2026
      const age = calculateAge("1980-06-15");
      expect(age).toBeGreaterThanOrEqual(45);
      expect(age).toBeLessThanOrEqual(46);
    });

    it("should calculate age when birthday has already passed this year", () => {
      // Born Jan 1, 2000 -- by Feb 2026 the birthday has passed
      const age = calculateAge("2000-01-01");
      expect(age).toBe(26);
    });

    it("should calculate age when birthday has not yet happened this year", () => {
      // Born Dec 31, 2000 -- by Feb 2026 the birthday has NOT passed
      const age = calculateAge("2000-12-31");
      expect(age).toBe(25);
    });

    it("should calculate age for a very old date", () => {
      const age = calculateAge("1920-03-10");
      expect(age).toBeGreaterThanOrEqual(105);
    });

    it("should return 0 for a baby born this year before today", () => {
      // Born Jan 1 of the current year -- age is 0 (birthday passed, but still under 1)
      const thisYear = new Date().getFullYear();
      const age = calculateAge(`${thisYear}-01-01`);
      expect(age).toBe(0);
    });

    it("should handle leap year birthday (Feb 29)", () => {
      // Born Feb 29, 2000
      const age = calculateAge("2000-02-29");
      // In Feb 2026, Feb 29 hasn't happened (2026 is not a leap year),
      // so age should be 25
      expect(age).toBe(25);
    });
  });

  // ─── formatShortDateWithLocale ────────────────────────────────────────────

  describe("formatShortDateWithLocale", () => {
    it("should format in US locale (en-US): 'Jan 15, 2025'", () => {
      const result = formatShortDateWithLocale("2025-01-15", { country: "US" });
      expect(result).toBe("Jan 15, 2025");
    });

    it("should format in GB locale (en-GB): '15 Jan 2025'", () => {
      const result = formatShortDateWithLocale("2025-01-15", { country: "GB" });
      expect(result).toBe("15 Jan 2025");
    });

    it("should format in CA locale (en-CA): 'Jan 15, 2025'", () => {
      const result = formatShortDateWithLocale("2025-01-15", { country: "CA" });
      // en-CA short month format varies by runtime (may or may not include period)
      expect(result).toBe("Jan 15, 2025");
    });

    it("should return em dash for null", () => {
      expect(formatShortDateWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatShortDateWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date string", () => {
      expect(formatShortDateWithLocale("not-a-date", { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for empty string", () => {
      expect(formatShortDateWithLocale("", { country: "US" })).toBe("\u2014");
    });

    it("should accept a Date object", () => {
      const date = new Date("2025-01-15T12:00:00Z");
      const result = formatShortDateWithLocale(date, { country: "US" });
      expect(result).toBe("Jan 15, 2025");
    });

    it("should handle YYYY-MM-DD string with noon anchoring (no timezone shift)", () => {
      // "2025-01-01" should be anchored at noon to prevent day-shift in western timezones
      const result = formatShortDateWithLocale("2025-01-01", { country: "US" });
      expect(result).toBe("Jan 1, 2025");
    });

    it("should handle ISO datetime strings as-is", () => {
      const result = formatShortDateWithLocale("2025-06-15T08:30:00Z", { country: "US" });
      expect(result).toBe("Jun 15, 2025");
    });

    it("should respect the timezone option", () => {
      // Midnight UTC on Jan 16 is still Jan 15 in US Pacific
      const result = formatShortDateWithLocale("2025-01-16T00:30:00Z", {
        country: "US",
        timezone: "America/Los_Angeles",
      });
      expect(result).toBe("Jan 15, 2025");
    });

    it("should default to UTC when no timezone is provided", () => {
      const result = formatShortDateWithLocale("2025-01-16T00:30:00Z", { country: "US" });
      expect(result).toBe("Jan 16, 2025");
    });

    it("should fall back to en-US locale for unknown country codes", () => {
      // getLocaleForCountry returns "en-US" for unknown countries
      const result = formatShortDateWithLocale("2025-01-15", { country: "XX" });
      expect(result).toBe("Jan 15, 2025");
    });
  });

  // ─── formatMediumDateWithLocale ───────────────────────────────────────────

  describe("formatMediumDateWithLocale", () => {
    it("should format in US locale with long month: 'January 15, 2025'", () => {
      const result = formatMediumDateWithLocale("2025-01-15", { country: "US" });
      expect(result).toBe("January 15, 2025");
    });

    it("should format in GB locale with long month: '15 January 2025'", () => {
      const result = formatMediumDateWithLocale("2025-01-15", { country: "GB" });
      expect(result).toBe("15 January 2025");
    });

    it("should return em dash for null", () => {
      expect(formatMediumDateWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatMediumDateWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date", () => {
      expect(formatMediumDateWithLocale("invalid", { country: "US" })).toBe("\u2014");
    });

    it("should accept a Date object", () => {
      const date = new Date("2025-07-04T12:00:00Z");
      const result = formatMediumDateWithLocale(date, { country: "US" });
      expect(result).toBe("July 4, 2025");
    });
  });

  // ─── formatDateTimeWithLocale ─────────────────────────────────────────────

  describe("formatDateTimeWithLocale", () => {
    it("should format date and time in US locale", () => {
      const result = formatDateTimeWithLocale("2025-11-25T15:45:00Z", { country: "US" });
      // en-US: "Nov 25, 2025, 3:45 PM"  (exact formatting may vary slightly by runtime)
      expect(result).toContain("Nov");
      expect(result).toContain("25");
      expect(result).toContain("2025");
      expect(result).toMatch(/3:45/);
      expect(result).toMatch(/PM/);
    });

    it("should format date and time in GB locale", () => {
      const result = formatDateTimeWithLocale("2025-11-25T15:45:00Z", { country: "GB" });
      // en-GB: "25 Nov 2025, 15:45"
      expect(result).toContain("Nov");
      expect(result).toContain("25");
      expect(result).toContain("2025");
      expect(result).toMatch(/15:45/);
    });

    it("should return em dash for null", () => {
      expect(formatDateTimeWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatDateTimeWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date", () => {
      expect(formatDateTimeWithLocale("garbage", { country: "US" })).toBe("\u2014");
    });

    it("should respect timezone option for time display", () => {
      // 3:45 PM UTC should be 7:45 AM in Pacific
      const result = formatDateTimeWithLocale("2025-11-25T15:45:00Z", {
        country: "US",
        timezone: "America/Los_Angeles",
      });
      expect(result).toMatch(/7:45/);
      expect(result).toMatch(/AM/);
    });
  });

  // ─── formatNumericDateTimeWithLocale ──────────────────────────────────────

  describe("formatNumericDateTimeWithLocale", () => {
    it("should format numeric date and time in US locale", () => {
      const result = formatNumericDateTimeWithLocale("2025-11-25T15:45:00Z", { country: "US" });
      // en-US numeric: "11/25/2025, 3:45 PM"
      expect(result).toContain("11/25/2025");
      expect(result).toMatch(/3:45/);
      expect(result).toMatch(/PM/);
    });

    it("should format numeric date and time in GB locale", () => {
      const result = formatNumericDateTimeWithLocale("2025-11-25T15:45:00Z", { country: "GB" });
      // en-GB numeric: "25/11/2025, 15:45"
      expect(result).toContain("25/11/2025");
      expect(result).toMatch(/15:45/);
    });

    it("should return em dash for null", () => {
      expect(formatNumericDateTimeWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatNumericDateTimeWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date", () => {
      expect(formatNumericDateTimeWithLocale("nope", { country: "US" })).toBe("\u2014");
    });
  });

  // ─── formatFullDateWithLocale ─────────────────────────────────────────────

  describe("formatFullDateWithLocale", () => {
    it("should include weekday in US locale", () => {
      // 2025-01-15 is a Wednesday
      const result = formatFullDateWithLocale("2025-01-15", { country: "US" });
      expect(result).toBe("Wednesday, January 15, 2025");
    });

    it("should include weekday in GB locale", () => {
      const result = formatFullDateWithLocale("2025-01-15", { country: "GB" });
      expect(result).toBe("Wednesday, 15 January 2025");
    });

    it("should return em dash for null", () => {
      expect(formatFullDateWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatFullDateWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date", () => {
      expect(formatFullDateWithLocale("bad-date", { country: "US" })).toBe("\u2014");
    });

    it("should handle a Date object", () => {
      const date = new Date("2025-07-04T12:00:00Z");
      const result = formatFullDateWithLocale(date, { country: "US" });
      expect(result).toBe("Friday, July 4, 2025");
    });
  });

  // ─── formatDateWithLocale ─────────────────────────────────────────────────

  describe("formatDateWithLocale", () => {
    it("should format a simple numeric date in US locale", () => {
      const result = formatDateWithLocale("2025-01-15", { country: "US" });
      expect(result).toBe("1/15/2025");
    });

    it("should format a simple numeric date in GB locale", () => {
      const result = formatDateWithLocale("2025-01-15", { country: "GB" });
      expect(result).toBe("15/01/2025");
    });

    it("should return em dash for null", () => {
      expect(formatDateWithLocale(null, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for undefined", () => {
      expect(formatDateWithLocale(undefined, { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for empty string", () => {
      expect(formatDateWithLocale("", { country: "US" })).toBe("\u2014");
    });

    it("should return em dash for invalid date", () => {
      expect(formatDateWithLocale("xyz", { country: "US" })).toBe("\u2014");
    });

    it("should handle a Date object", () => {
      const date = new Date("2025-03-20T12:00:00Z");
      const result = formatDateWithLocale(date, { country: "US" });
      expect(result).toBe("3/20/2025");
    });
  });

  // ─── Edge cases: parseDateValue behavior ──────────────────────────────────

  describe("Edge cases (parseDateValue via formatting functions)", () => {
    it("should anchor YYYY-MM-DD strings at noon to prevent timezone shift", () => {
      // A date-only string like "2025-01-01" must not shift to Dec 31 in US timezones.
      // The internal parseDateValue appends T12:00:00 to anchor at noon.
      // We verify by formatting with UTC -- it should still be Jan 1.
      const result = formatShortDateWithLocale("2025-01-01", { country: "US" });
      expect(result).toBe("Jan 1, 2025");
    });

    it("should parse ISO datetime strings as-is (no noon anchoring)", () => {
      // This is a full ISO string, so parseDateValue should NOT append T12:00:00
      const result = formatShortDateWithLocale("2025-06-15T23:59:59Z", { country: "US" });
      expect(result).toBe("Jun 15, 2025");
    });

    it("should pass Date objects through unchanged", () => {
      const original = new Date(2025, 5, 15, 10, 30, 0); // Jun 15, 2025 10:30 local
      const result = formatMediumDateWithLocale(original, { country: "US", timezone: "UTC" });
      expect(result).toContain("2025");
      expect(result).toContain("June") // Month should be June regardless
    });

    it("should handle date string with time but no Z suffix", () => {
      // "2025-01-15T08:00:00" is local time, not UTC
      const result = formatShortDateWithLocale("2025-01-15T08:00:00", { country: "US" });
      expect(result).toContain("Jan");
      expect(result).toContain("2025");
    });
  });

  // ─── Integration scenarios ────────────────────────────────────────────────

  describe("Integration scenarios", () => {
    it("should format the same date consistently across all format functions (US)", () => {
      const dateStr = "2025-01-15";
      const opts = { country: "US" } as const;

      const short = formatShortDateWithLocale(dateStr, opts);
      const medium = formatMediumDateWithLocale(dateStr, opts);
      const full = formatFullDateWithLocale(dateStr, opts);
      const simple = formatDateWithLocale(dateStr, opts);

      // All should reference Jan 15, 2025
      expect(short).toBe("Jan 15, 2025");
      expect(medium).toBe("January 15, 2025");
      expect(full).toBe("Wednesday, January 15, 2025");
      expect(simple).toBe("1/15/2025");
    });

    it("should format the same date consistently across all format functions (GB)", () => {
      const dateStr = "2025-01-15";
      const opts = { country: "GB" } as const;

      const short = formatShortDateWithLocale(dateStr, opts);
      const medium = formatMediumDateWithLocale(dateStr, opts);
      const full = formatFullDateWithLocale(dateStr, opts);
      const simple = formatDateWithLocale(dateStr, opts);

      expect(short).toBe("15 Jan 2025");
      expect(medium).toBe("15 January 2025");
      expect(full).toBe("Wednesday, 15 January 2025");
      expect(simple).toBe("15/01/2025");
    });

    it("should handle a DOB date through parseLocalDate and calculateAge", () => {
      const dob = "2000-06-15";
      const parsed = parseLocalDate(dob);
      expect(parsed.getFullYear()).toBe(2000);
      expect(parsed.getMonth()).toBe(5); // June
      expect(parsed.getDate()).toBe(15);

      const age = calculateAge(dob);
      expect(age).toBeGreaterThanOrEqual(25);
      expect(age).toBeLessThanOrEqual(26);
    });

    it("should return em dash from all format functions for null input", () => {
      const opts = { country: "US" };
      expect(formatShortDateWithLocale(null, opts)).toBe("\u2014");
      expect(formatMediumDateWithLocale(null, opts)).toBe("\u2014");
      expect(formatDateTimeWithLocale(null, opts)).toBe("\u2014");
      expect(formatNumericDateTimeWithLocale(null, opts)).toBe("\u2014");
      expect(formatFullDateWithLocale(null, opts)).toBe("\u2014");
      expect(formatDateWithLocale(null, opts)).toBe("\u2014");
    });
  });
});
