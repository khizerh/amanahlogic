import { describe, it, expect } from "vitest";
import { isValidPhoneForCountry, normalizePhoneForCountry, formatPhoneForCountry } from "../phone";
import {
  validateOrgSettings,
  validateCountryCurrencyAlignment,
  isValidTimezone,
} from "../validation";
import { formatCurrencyWithLocale } from "../currency";

describe("International Support Utilities", () => {
  describe("phone utilities (libphonenumber)", () => {
    it("validates country-specific numbers", () => {
      // Use valid area codes (212=NYC, 416=Toronto, 020=London)
      expect(isValidPhoneForCountry("(212) 555-1234", "US")).toBe(true);
      expect(isValidPhoneForCountry("020 7946 0958", "GB")).toBe(true); // London landline
      expect(isValidPhoneForCountry("(416) 555-1234", "CA")).toBe(true);
    });

    it("rejects invalid phone formats", () => {
      // Too few digits
      expect(isValidPhoneForCountry("123", "US")).toBe(false);
      expect(isValidPhoneForCountry("555", "GB")).toBe(false);
      // Empty/whitespace
      expect(isValidPhoneForCountry("", "US")).toBe(false);
      expect(isValidPhoneForCountry("   ", "GB")).toBe(false);
      // Note: isPossiblePhoneNumber is lenient - it checks format/length,
      // not strict country matching. This is intentional for admin tools
      // where test data may be entered.
    });

    it("normalizes to E.164 per country", () => {
      expect(normalizePhoneForCountry("(212) 555-1234", "US")).toBe("+12125551234");
      expect(normalizePhoneForCountry("020 7946 0958", "GB")).toBe("+442079460958");
      expect(normalizePhoneForCountry("(416) 555-1234", "CA")).toBe("+14165551234");
    });

    it("formats to national display per country", () => {
      expect(formatPhoneForCountry("+12125551234", "US")).toBe("(212) 555-1234");
      expect(formatPhoneForCountry("+442079460958", "GB")).toBe("020 7946 0958");
      expect(formatPhoneForCountry("+14165551234", "CA")).toBe("(416) 555-1234");
    });

    it("throws on invalid normalization", () => {
      expect(() => normalizePhoneForCountry("123", "US")).toThrow();
      expect(() => normalizePhoneForCountry("020 7946 0958", "US")).toThrow(); // UK number with US country
    });
  });

  describe("organization validation", () => {
    it("validates country/currency alignment", () => {
      expect(validateCountryCurrencyAlignment("US", "USD").valid).toBe(true);
      expect(validateCountryCurrencyAlignment("GB", "GBP").valid).toBe(true);
      expect(validateCountryCurrencyAlignment("CA", "CAD").valid).toBe(true);
      expect(validateCountryCurrencyAlignment("US", "GBP").valid).toBe(false);
    });

    it("returns errors for invalid org settings", () => {
      const errors = validateOrgSettings({
        country: "GB",
        currency: "USD",
        timezone: "Invalid/Zone",
      });
      // Order: timezone validation comes first, then currency alignment
      expect(errors).toEqual([
        "Invalid timezone: Invalid/Zone",
        "Currency USD does not match country GB (expected GBP)",
      ]);
    });

    it("accepts valid timezone identifiers", () => {
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
      expect(isValidTimezone("Invalid/Zone")).toBe(false);
    });
  });

  describe("currency formatting with locale", () => {
    it("formats currencies with locale-aware symbols", () => {
      expect(formatCurrencyWithLocale(100, "USD", "en-US")).toBe("$100.00");
      expect(formatCurrencyWithLocale(100, "GBP", "en-GB")).toBe("£100.00");
      expect(formatCurrencyWithLocale(100, "CAD", "en-CA")).toMatch(/^\$100\.00/);
    });

    it("handles null/undefined values", () => {
      expect(formatCurrencyWithLocale(null, "USD", "en-US")).toBe("$0.00");
      expect(formatCurrencyWithLocale(undefined, "GBP", "en-GB")).toBe("£0.00");
    });
  });
});
