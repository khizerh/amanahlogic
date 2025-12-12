/**
 * Currency Utility Tests
 *
 * Comprehensive tests for currency parsing, formatting, and conversion functions.
 * These utilities are critical for financial calculations across the entire system.
 */

import { describe, it, expect } from "vitest";
import { parseDecimal, formatCurrency, toDecimalString } from "../currency";

describe("Currency Utilities", () => {
  describe("parseDecimal", () => {
    it("should parse valid number strings", () => {
      expect(parseDecimal("123.45")).toBe(123.45);
      expect(parseDecimal("0.01")).toBe(0.01);
      expect(parseDecimal("1000")).toBe(1000);
      expect(parseDecimal("999.99")).toBe(999.99);
    });

    it("should parse numbers directly", () => {
      expect(parseDecimal(123.45)).toBe(123.45);
      expect(parseDecimal(0)).toBe(0);
      expect(parseDecimal(1000)).toBe(1000);
      expect(parseDecimal(0.01)).toBe(0.01);
    });

    it("should handle null and undefined", () => {
      expect(parseDecimal(null)).toBe(0);
      expect(parseDecimal(undefined)).toBe(0);
    });

    it("should handle empty strings", () => {
      expect(parseDecimal("")).toBe(0);
    });

    it("should handle invalid strings", () => {
      expect(parseDecimal("abc")).toBe(0);
      expect(parseDecimal("$100")).toBe(0);
      expect(parseDecimal("not a number")).toBe(0);
    });

    it("should handle negative numbers", () => {
      expect(parseDecimal("-123.45")).toBe(-123.45);
      expect(parseDecimal(-100)).toBe(-100);
    });

    it("should handle very small decimals", () => {
      expect(parseDecimal("0.001")).toBe(0.001);
      expect(parseDecimal("0.0001")).toBe(0.0001);
    });

    it("should handle very large numbers", () => {
      expect(parseDecimal("999999.99")).toBe(999999.99);
      expect(parseDecimal("1000000")).toBe(1000000);
    });

    it("should handle strings with leading/trailing whitespace", () => {
      expect(parseDecimal("  123.45  ")).toBe(123.45);
      expect(parseDecimal("\n100\t")).toBe(100);
    });

    it("should handle scientific notation", () => {
      expect(parseDecimal("1e2")).toBe(100);
      expect(parseDecimal("1.5e3")).toBe(1500);
    });
  });

  describe("formatCurrency", () => {
    it("should format numbers as USD currency", () => {
      expect(formatCurrency(123.45)).toBe("$123.45");
      expect(formatCurrency(1000)).toBe("$1,000.00");
      expect(formatCurrency(0)).toBe("$0.00");
      expect(formatCurrency(0.01)).toBe("$0.01");
    });

    it("should format string numbers", () => {
      expect(formatCurrency("123.45")).toBe("$123.45");
      expect(formatCurrency("1000")).toBe("$1,000.00");
      expect(formatCurrency("999.99")).toBe("$999.99");
    });

    it("should handle null and undefined", () => {
      expect(formatCurrency(null)).toBe("$0.00");
      expect(formatCurrency(undefined)).toBe("$0.00");
    });

    it("should always show 2 decimal places", () => {
      expect(formatCurrency(10)).toBe("$10.00");
      expect(formatCurrency(10.5)).toBe("$10.50");
      expect(formatCurrency(10.1)).toBe("$10.10");
    });

    it("should handle negative amounts", () => {
      expect(formatCurrency(-123.45)).toBe("-$123.45");
      expect(formatCurrency(-1000)).toBe("-$1,000.00");
    });

    it("should add thousands separators", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(123456.78)).toBe("$123,456.78");
      expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
    });

    it("should handle very large amounts", () => {
      expect(formatCurrency(999999.99)).toBe("$999,999.99");
      expect(formatCurrency(1000000)).toBe("$1,000,000.00");
      expect(formatCurrency(10000000.5)).toBe("$10,000,000.50");
    });

    it("should handle very small amounts", () => {
      expect(formatCurrency(0.01)).toBe("$0.01");
      expect(formatCurrency(0.99)).toBe("$0.99");
      expect(formatCurrency(0.001)).toBe("$0.00"); // Rounds to 2 decimals
    });

    it("should handle rounding correctly", () => {
      expect(formatCurrency(10.555)).toBe("$10.56"); // Rounds up
      expect(formatCurrency(10.554)).toBe("$10.55"); // Rounds down
      expect(formatCurrency(10.999)).toBe("$11.00"); // Rounds up to next dollar
    });

    it("should handle database decimal strings (common use case)", () => {
      // Supabase returns DECIMAL as strings
      expect(formatCurrency("150.00")).toBe("$150.00");
      expect(formatCurrency("1250.50")).toBe("$1,250.50");
    });

    it("should handle invalid input gracefully", () => {
      expect(formatCurrency("abc")).toBe("$0.00");
      expect(formatCurrency("$100")).toBe("$0.00");
    });
  });

  describe("toDecimalString", () => {
    it("should convert numbers to 2-decimal strings", () => {
      expect(toDecimalString(123.45)).toBe("123.45");
      expect(toDecimalString(100)).toBe("100.00");
      expect(toDecimalString(0)).toBe("0.00");
      expect(toDecimalString(0.01)).toBe("0.01");
    });

    it("should always include 2 decimal places", () => {
      expect(toDecimalString(10)).toBe("10.00");
      expect(toDecimalString(10.5)).toBe("10.50");
      expect(toDecimalString(10.1)).toBe("10.10");
    });

    it("should handle negative numbers", () => {
      expect(toDecimalString(-123.45)).toBe("-123.45");
      expect(toDecimalString(-100)).toBe("-100.00");
    });

    it("should round to 2 decimals", () => {
      // JavaScript's toFixed uses banker's rounding (round to even)
      expect(toDecimalString(10.555)).toBe("10.55"); // Rounds to even
      expect(toDecimalString(10.554)).toBe("10.55"); // Rounds down
      expect(toDecimalString(10.556)).toBe("10.56"); // Rounds up
      expect(toDecimalString(10.999)).toBe("11.00");
    });

    it("should handle very large numbers", () => {
      expect(toDecimalString(999999.99)).toBe("999999.99");
      expect(toDecimalString(1000000)).toBe("1000000.00");
    });

    it("should handle very small numbers", () => {
      expect(toDecimalString(0.01)).toBe("0.01");
      expect(toDecimalString(0.001)).toBe("0.00"); // Rounds to 2 decimals
    });

    it("should prepare values for database insertion", () => {
      // Common use case: preparing tuition amounts for insertion
      expect(toDecimalString(150)).toBe("150.00");
      expect(toDecimalString(1250.5)).toBe("1250.50");
    });
  });

  describe("Integration scenarios", () => {
    it("should handle full round-trip: parse -> format -> parse", () => {
      const original = "150.50";
      const parsed = parseDecimal(original);
      const formatted = formatCurrency(parsed);
      expect(formatted).toBe("$150.50");

      // Extract number from formatted string (if needed)
      const reExtracted = parseDecimal(formatted.replace(/[$,]/g, ""));
      expect(reExtracted).toBe(150.5);
    });

    it("should handle database round-trip: number -> string -> parse -> format", () => {
      // Simulate: JS number -> DB storage -> retrieval -> display
      const jsNumber = 1250.75;
      const dbString = toDecimalString(jsNumber);
      expect(dbString).toBe("1250.75");

      const parsed = parseDecimal(dbString);
      expect(parsed).toBe(1250.75);

      const displayed = formatCurrency(parsed);
      expect(displayed).toBe("$1,250.75");
    });

    it("should handle tuition calculations correctly", () => {
      // Real-world scenario: base tuition with discount
      const baseTuition = parseDecimal("200.00");
      const discount = parseDecimal("20.00");
      const final = baseTuition - discount;

      expect(final).toBe(180);
      expect(formatCurrency(final)).toBe("$180.00");
      expect(toDecimalString(final)).toBe("180.00");
    });

    it("should handle payment calculations with fees", () => {
      // Stripe fee calculation: amount + (amount * 0.029 + 0.30)
      const amount = parseDecimal("100.00");
      const stripeFee = amount * 0.029 + 0.3;
      const total = amount + stripeFee;

      expect(parseFloat(toDecimalString(total))).toBeCloseTo(103.2, 2);
    });

    it("should handle monthly recurring billing amounts", () => {
      // Monthly tuition over 10 months
      const annualTuition = parseDecimal("2000.00");
      const monthlyAmount = annualTuition / 10;

      expect(monthlyAmount).toBe(200);
      expect(formatCurrency(monthlyAmount)).toBe("$200.00");
      expect(toDecimalString(monthlyAmount)).toBe("200.00");
    });

    it("should handle sibling discount calculations", () => {
      // 10% sibling discount
      const baseTuition = parseDecimal("150.00");
      const discountPercent = 10;
      const discountAmount = (baseTuition * discountPercent) / 100;
      const finalTuition = baseTuition - discountAmount;

      expect(discountAmount).toBe(15);
      expect(finalTuition).toBe(135);
      expect(formatCurrency(finalTuition)).toBe("$135.00");
    });

    it("should handle zero and edge cases in billing", () => {
      // Free program (zakaat/scholarship)
      expect(formatCurrency(0)).toBe("$0.00");
      expect(toDecimalString(0)).toBe("0.00");

      // Minimum payment (1 cent)
      expect(formatCurrency(0.01)).toBe("$0.01");
      expect(toDecimalString(0.01)).toBe("0.01");
    });
  });
});
