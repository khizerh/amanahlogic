/**
 * Phone Utility Tests
 *
 * Comprehensive tests for phone number formatting, normalization, and validation.
 * These utilities ensure consistent phone number handling across the system.
 */

import { describe, it, expect } from "vitest";
import { formatPhoneNumber, normalizePhoneNumber, isValidPhoneNumber } from "../phone";

describe("Phone Utilities", () => {
  describe("formatPhoneNumber", () => {
    it("should format 10-digit numbers correctly", () => {
      expect(formatPhoneNumber("1234567890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
      expect(formatPhoneNumber("9876543210")).toBe("(987) 654-3210");
    });

    it("should format numbers with +1 country code", () => {
      expect(formatPhoneNumber("+11234567890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("+15551234567")).toBe("(555) 123-4567");
    });

    it("should format numbers with 1 prefix (11 digits)", () => {
      expect(formatPhoneNumber("11234567890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("15551234567")).toBe("(555) 123-4567");
    });

    it("should format partially entered numbers", () => {
      expect(formatPhoneNumber("1")).toBe("(1");
      expect(formatPhoneNumber("12")).toBe("(12");
      expect(formatPhoneNumber("123")).toBe("(123");
      expect(formatPhoneNumber("1234")).toBe("(123) 4");
      expect(formatPhoneNumber("12345")).toBe("(123) 45");
      expect(formatPhoneNumber("123456")).toBe("(123) 456");
      expect(formatPhoneNumber("1234567")).toBe("(123) 456-7");
      expect(formatPhoneNumber("12345678")).toBe("(123) 456-78");
      expect(formatPhoneNumber("123456789")).toBe("(123) 456-789");
    });

    it("should handle numbers with existing formatting", () => {
      expect(formatPhoneNumber("(123) 456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123-456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123.456.7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123 456 7890")).toBe("(123) 456-7890");
    });

    it("should handle numbers with dashes", () => {
      expect(formatPhoneNumber("123-456-7890")).toBe("(123) 456-7890");
    });

    it("should handle numbers with spaces", () => {
      expect(formatPhoneNumber("123 456 7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("(123) 456 7890")).toBe("(123) 456-7890");
    });

    it("should handle numbers with dots", () => {
      expect(formatPhoneNumber("123.456.7890")).toBe("(123) 456-7890");
    });

    it("should limit to 10 digits", () => {
      expect(formatPhoneNumber("12345678901234")).toBe("(123) 456-7890");
    });

    it("should handle empty string", () => {
      expect(formatPhoneNumber("")).toBe("");
    });

    it("should strip non-digit characters", () => {
      expect(formatPhoneNumber("abc123def456ghi7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("(123) 456-7890 ext 123")).toBe("(123) 456-7890");
    });

    it("should handle international format +1", () => {
      expect(formatPhoneNumber("+1-123-456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("+1 (123) 456-7890")).toBe("(123) 456-7890");
    });
  });

  describe("normalizePhoneNumber", () => {
    it("should normalize 10-digit numbers to E.164 format", () => {
      expect(normalizePhoneNumber("1234567890")).toBe("+11234567890");
      expect(normalizePhoneNumber("5551234567")).toBe("+15551234567");
      expect(normalizePhoneNumber("9876543210")).toBe("+19876543210");
    });

    it("should handle numbers with 1 prefix (11 digits)", () => {
      expect(normalizePhoneNumber("11234567890")).toBe("+11234567890");
      expect(normalizePhoneNumber("15551234567")).toBe("+15551234567");
    });

    it("should handle numbers with +1 prefix", () => {
      expect(normalizePhoneNumber("+11234567890")).toBe("+11234567890");
      expect(normalizePhoneNumber("+15551234567")).toBe("+15551234567");
    });

    it("should strip formatting and normalize", () => {
      expect(normalizePhoneNumber("(123) 456-7890")).toBe("+11234567890");
      expect(normalizePhoneNumber("123-456-7890")).toBe("+11234567890");
      expect(normalizePhoneNumber("123.456.7890")).toBe("+11234567890");
      expect(normalizePhoneNumber("123 456 7890")).toBe("+11234567890");
    });

    it("should handle partially entered numbers", () => {
      expect(normalizePhoneNumber("123")).toBe(""); // Less than 10 digits
      expect(normalizePhoneNumber("1234567")).toBe(""); // Less than 10 digits
      expect(normalizePhoneNumber("123456789")).toBe(""); // 9 digits, invalid
    });

    it("should return empty string for invalid input", () => {
      expect(normalizePhoneNumber("")).toBe("");
      expect(normalizePhoneNumber("abc")).toBe("");
      expect(normalizePhoneNumber("123")).toBe("");
    });

    it("should handle numbers with extra characters", () => {
      // Implementation strips all non-digits, takes first 10, removes leading 1 if 11 total
      expect(normalizePhoneNumber("(123) 456-7890 ext 123")).toBe("+11234567890"); // ext 123 -> digits: 1234567890123, take first 10
      expect(normalizePhoneNumber("+1 (123) 456-7890 x999")).toBe("+11123456789"); // +1 prefix, digits: 11234567890999, starts with 1 & 11 digits, take from position 1
    });

    it("should prepare numbers for Twilio/SMS APIs", () => {
      // Common use case: sending SMS via Twilio requires E.164 format
      const userInput = "(555) 123-4567";
      const normalized = normalizePhoneNumber(userInput);
      expect(normalized).toBe("+15551234567");
    });

    it("should prepare numbers for database storage", () => {
      // Standardize format for storage
      const formats = [
        "5551234567",
        "(555) 123-4567",
        "555-123-4567",
        "555.123.4567",
        "+1 555 123 4567",
      ];

      formats.forEach((format) => {
        expect(normalizePhoneNumber(format)).toBe("+15551234567");
      });
    });
  });

  describe("isValidPhoneNumber", () => {
    it("should validate correct 10-digit US numbers", () => {
      expect(isValidPhoneNumber("1234567890")).toBe(true);
      expect(isValidPhoneNumber("5551234567")).toBe(true);
      expect(isValidPhoneNumber("9876543210")).toBe(true);
    });

    it("should validate numbers with +1 prefix", () => {
      expect(isValidPhoneNumber("+11234567890")).toBe(true);
      expect(isValidPhoneNumber("+15551234567")).toBe(true);
    });

    it("should validate numbers with 1 prefix (11 digits)", () => {
      expect(isValidPhoneNumber("11234567890")).toBe(true);
      expect(isValidPhoneNumber("15551234567")).toBe(true);
    });

    it("should validate formatted numbers", () => {
      expect(isValidPhoneNumber("(123) 456-7890")).toBe(true);
      expect(isValidPhoneNumber("123-456-7890")).toBe(true);
      expect(isValidPhoneNumber("123.456.7890")).toBe(true);
      expect(isValidPhoneNumber("123 456 7890")).toBe(true);
    });

    it("should reject numbers with too few digits", () => {
      expect(isValidPhoneNumber("123")).toBe(false);
      expect(isValidPhoneNumber("1234567")).toBe(false);
      expect(isValidPhoneNumber("123456789")).toBe(false); // 9 digits
    });

    it("should reject numbers with too many digits", () => {
      expect(isValidPhoneNumber("123456789012")).toBe(false); // More than 11
    });

    it("should reject empty string", () => {
      expect(isValidPhoneNumber("")).toBe(false);
    });

    it("should reject invalid input", () => {
      expect(isValidPhoneNumber("abc")).toBe(false);
      expect(isValidPhoneNumber("not a phone")).toBe(false);
    });

    it("should reject partially entered numbers", () => {
      expect(isValidPhoneNumber("123")).toBe(false);
      expect(isValidPhoneNumber("12345")).toBe(false);
      expect(isValidPhoneNumber("123456789")).toBe(false);
    });

    it("should handle numbers with extensions", () => {
      // Extensions add extra digits which makes the number invalid (> 11 digits)
      expect(isValidPhoneNumber("(123) 456-7890 ext 123")).toBe(false);
      expect(isValidPhoneNumber("+1 (123) 456-7890 x999")).toBe(false);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle form input -> validation -> normalization -> display", () => {
      const userInput = "5551234567";

      // Validate
      expect(isValidPhoneNumber(userInput)).toBe(true);

      // Normalize for storage
      const normalized = normalizePhoneNumber(userInput);
      expect(normalized).toBe("+15551234567");

      // Format for display
      const formatted = formatPhoneNumber(normalized);
      expect(formatted).toBe("(555) 123-4567");
    });

    it("should handle progressive formatting as user types", () => {
      // Simulating user typing in a form
      const inputs = [
        { value: "5", expected: "(5" },
        { value: "55", expected: "(55" },
        { value: "555", expected: "(555" },
        { value: "5551", expected: "(555) 1" },
        { value: "55512", expected: "(555) 12" },
        { value: "555123", expected: "(555) 123" },
        { value: "5551234", expected: "(555) 123-4" },
        { value: "55512345", expected: "(555) 123-45" },
        { value: "555123456", expected: "(555) 123-456" },
        { value: "5551234567", expected: "(555) 123-4567" },
      ];

      inputs.forEach(({ value, expected }) => {
        expect(formatPhoneNumber(value)).toBe(expected);
      });
    });

    it("should handle database storage and retrieval", () => {
      // User submits form
      const userInput = "(555) 123-4567";

      // Normalize for storage
      const forStorage = normalizePhoneNumber(userInput);
      expect(forStorage).toBe("+15551234567");

      // Later: retrieve from DB and format for display
      const retrieved = forStorage; // Simulating DB retrieval
      const displayed = formatPhoneNumber(retrieved);
      expect(displayed).toBe("(555) 123-4567");
    });

    it("should handle various input formats consistently", () => {
      const formats = [
        "5551234567",
        "(555) 123-4567",
        "555-123-4567",
        "555.123.4567",
        "+1 555 123 4567",
        "1 (555) 123-4567",
        "+1-555-123-4567",
        "15551234567",
      ];

      formats.forEach((format) => {
        // All should validate
        expect(isValidPhoneNumber(format)).toBe(true);

        // All should normalize to same value
        expect(normalizePhoneNumber(format)).toBe("+15551234567");

        // All should format to same display
        expect(formatPhoneNumber(format)).toBe("(555) 123-4567");
      });
    });

    it("should handle real-world edge cases", () => {
      // User pastes number with weird formatting (no extensions)
      const weirdFormat = "+1 (555) 123-4567";
      expect(isValidPhoneNumber(weirdFormat)).toBe(true);
      expect(normalizePhoneNumber(weirdFormat)).toBe("+15551234567");
      expect(formatPhoneNumber(weirdFormat)).toBe("(555) 123-4567");
    });

    it("should prepare for Twilio SMS sending", () => {
      const fatherPhone = "(555) 123-4567";
      const motherPhone = "555-987-6543";

      const fatherE164 = normalizePhoneNumber(fatherPhone);
      const motherE164 = normalizePhoneNumber(motherPhone);

      expect(fatherE164).toBe("+15551234567");
      expect(motherE164).toBe("+15559876543");

      // Both ready for Twilio API
      expect(fatherE164.startsWith("+1")).toBe(true);
      expect(motherE164.startsWith("+1")).toBe(true);
    });

    it("should validate before saving to database", () => {
      const validPhone = "5551234567";
      const invalidPhone = "123";

      if (isValidPhoneNumber(validPhone)) {
        const normalized = normalizePhoneNumber(validPhone);
        expect(normalized).toBe("+15551234567");
        // Would save to DB
      }

      if (!isValidPhoneNumber(invalidPhone)) {
        // Would show error to user
        expect(normalizePhoneNumber(invalidPhone)).toBe("");
      }
    });
  });
});
