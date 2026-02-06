/**
 * Payment Utilities Tests
 *
 * Comprehensive tests for payment URL generation, recipient resolution,
 * error formatting, and Stripe error detection utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOrgBaseUrl,
  buildCheckoutUrls,
  resolvePaymentRecipient,
  resolveRecipientWithFallback,
  formatError,
  isStripeConfigurationError,
  isStripeResourceMissingError,
} from "../utils";
import type { FamilyData, StudentData } from "../types";

// Mock @/lib/utils to control calculateAge return values
vi.mock("@/lib/utils", () => ({
  calculateAge: vi.fn(),
}));

import { calculateAge } from "@/lib/utils";
const mockCalculateAge = vi.mocked(calculateAge);

// ---------------------------------------------------------------------------
// Helpers: reusable test fixtures
// ---------------------------------------------------------------------------

function makeStudent(overrides: Partial<StudentData> = {}): StudentData {
  return {
    id: "student-1",
    name: "Ali Khan",
    family_id: "family-1",
    dob: "2000-01-01",
    student_email: "ali@example.com",
    ...overrides,
  };
}

function makeFamily(overrides: Partial<FamilyData> = {}): FamilyData {
  return {
    id: "family-1",
    family_name: "Khan",
    primary_contact_type: "father",
    father_name: "Ahmed Khan",
    father_email: "ahmed@example.com",
    mother_name: "Fatima Khan",
    mother_email: "fatima@example.com",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore environment after each test
  process.env = { ...ORIGINAL_ENV };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Payment Utilities", () => {
  // =========================================================================
  // getOrgBaseUrl
  // =========================================================================

  describe("getOrgBaseUrl", () => {
    it("should return subdomain URL when orgSlug is provided", () => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      const url = getOrgBaseUrl("my-org");
      expect(url).toBe("https://my-org.amanahlogic.com");
    });

    it("should use NEXT_PUBLIC_APP_DOMAIN when set", () => {
      process.env.NEXT_PUBLIC_APP_DOMAIN = "custom-domain.io";
      const url = getOrgBaseUrl("my-org");
      expect(url).toBe("https://my-org.custom-domain.io");
    });

    it("should return fallback app URL when orgSlug is null", () => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const url = getOrgBaseUrl(null);
      expect(url).toBe("https://app.amanahlogic.com");
    });

    it("should return fallback app URL when orgSlug is undefined", () => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const url = getOrgBaseUrl(undefined);
      expect(url).toBe("https://app.amanahlogic.com");
    });

    it("should return fallback app URL when called without arguments", () => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const url = getOrgBaseUrl();
      expect(url).toBe("https://app.amanahlogic.com");
    });

    it("should use NEXT_PUBLIC_BASE_URL as fallback when orgSlug is missing", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "https://override.example.com";
      const url = getOrgBaseUrl(null);
      expect(url).toBe("https://override.example.com");
    });

    it("should prefer subdomain URL over NEXT_PUBLIC_BASE_URL when orgSlug is provided", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "https://override.example.com";
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      const url = getOrgBaseUrl("my-org");
      expect(url).toBe("https://my-org.amanahlogic.com");
    });

    it("should return fallback when orgSlug is empty string (falsy)", () => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const url = getOrgBaseUrl("");
      expect(url).toBe("https://app.amanahlogic.com");
    });
  });

  // =========================================================================
  // buildCheckoutUrls
  // =========================================================================

  describe("buildCheckoutUrls", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
    });

    it("should build success and cancel URLs with org subdomain", () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(
        "my-org",
        "/billing",
        { success: "success", cancelled: "cancelled" }
      );

      expect(successUrl).toBe("https://my-org.amanahlogic.com/billing?payment=success");
      expect(cancelUrl).toBe("https://my-org.amanahlogic.com/billing?payment=cancelled");
    });

    it("should build URLs without subdomain when orgSlug is null", () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(
        null,
        "/billing",
        { success: "success", cancelled: "cancelled" }
      );

      expect(successUrl).toBe("https://app.amanahlogic.com/billing?payment=success");
      expect(cancelUrl).toBe("https://app.amanahlogic.com/billing?payment=cancelled");
    });

    it("should build URLs without subdomain when orgSlug is undefined", () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(
        undefined,
        "/billing",
        { success: "success", cancelled: "cancelled" }
      );

      expect(successUrl).toBe("https://app.amanahlogic.com/billing?payment=success");
      expect(cancelUrl).toBe("https://app.amanahlogic.com/billing?payment=cancelled");
    });

    it("should append correct custom query parameter values", () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(
        "org",
        "/checkout",
        { success: "done", cancelled: "aborted" }
      );

      expect(successUrl).toBe("https://org.amanahlogic.com/checkout?payment=done");
      expect(cancelUrl).toBe("https://org.amanahlogic.com/checkout?payment=aborted");
    });

    it("should handle different return paths", () => {
      const { successUrl } = buildCheckoutUrls(
        "org",
        "/dashboard/payments",
        { success: "ok", cancelled: "no" }
      );

      expect(successUrl).toBe("https://org.amanahlogic.com/dashboard/payments?payment=ok");
    });

    it("should respect NEXT_PUBLIC_APP_DOMAIN in built URLs", () => {
      process.env.NEXT_PUBLIC_APP_DOMAIN = "custom.app";
      const { successUrl } = buildCheckoutUrls(
        "school",
        "/pay",
        { success: "complete", cancelled: "cancel" }
      );

      expect(successUrl).toBe("https://school.custom.app/pay?payment=complete");
    });
  });

  // =========================================================================
  // resolvePaymentRecipient
  // =========================================================================

  describe("resolvePaymentRecipient", () => {
    beforeEach(() => {
      mockCalculateAge.mockReset();
    });

    it("should return student email when student is adult (18+) with email", () => {
      mockCalculateAge.mockReturnValue(20);

      const result = resolvePaymentRecipient(
        makeStudent({ student_email: "ali@example.com", name: "Ali Khan" }),
        makeFamily()
      );

      expect(result).toEqual({
        email: "ali@example.com",
        name: "Ali Khan",
        isStudent: true,
      });
    });

    it("should return student email when student is exactly 18 with email", () => {
      mockCalculateAge.mockReturnValue(18);

      const result = resolvePaymentRecipient(
        makeStudent({ student_email: "student@example.com" }),
        makeFamily()
      );

      expect(result.email).toBe("student@example.com");
      expect(result.isStudent).toBe(true);
    });

    it("should return father (primary contact) email for a minor student", () => {
      mockCalculateAge.mockReturnValue(12);

      const result = resolvePaymentRecipient(
        makeStudent(),
        makeFamily({ primary_contact_type: "father", father_email: "dad@example.com", father_name: "Ahmed" })
      );

      expect(result).toEqual({
        email: "dad@example.com",
        name: "Ahmed",
        isStudent: false,
      });
    });

    it("should return mother email when mother is primary contact for a minor", () => {
      mockCalculateAge.mockReturnValue(10);

      const result = resolvePaymentRecipient(
        makeStudent(),
        makeFamily({
          primary_contact_type: "mother",
          mother_email: "mom@example.com",
          mother_name: "Fatima",
        })
      );

      expect(result).toEqual({
        email: "mom@example.com",
        name: "Fatima",
        isStudent: false,
      });
    });

    it("should fall back to primary contact when adult student has no email", () => {
      mockCalculateAge.mockReturnValue(22);

      const result = resolvePaymentRecipient(
        makeStudent({ student_email: null }),
        makeFamily({ father_email: "dad@example.com", father_name: "Ahmed" })
      );

      expect(result.email).toBe("dad@example.com");
      expect(result.name).toBe("Ahmed");
      expect(result.isStudent).toBe(false);
    });

    it("should return error when no email is available for a minor", () => {
      mockCalculateAge.mockReturnValue(10);

      const result = resolvePaymentRecipient(
        makeStudent(),
        makeFamily({ primary_contact_type: "father", father_email: null, father_name: null })
      );

      expect(result.email).toBeNull();
      expect(result.name).toBeNull();
      expect(result.isStudent).toBe(false);
      expect(result.error).toBe("Primary contact (father) has no email address.");
    });

    it("should include additional message in error when adult has no email", () => {
      mockCalculateAge.mockReturnValue(19);

      const result = resolvePaymentRecipient(
        makeStudent({ student_email: null }),
        makeFamily({ primary_contact_type: "father", father_email: null })
      );

      expect(result.error).toBe(
        "Primary contact (father) has no email address. Student also has no email."
      );
    });

    it("should return error mentioning mother when mother is primary with no email", () => {
      mockCalculateAge.mockReturnValue(8);

      const result = resolvePaymentRecipient(
        makeStudent(),
        makeFamily({ primary_contact_type: "mother", mother_email: null })
      );

      expect(result.error).toContain("Primary contact (mother) has no email address.");
    });

    it("should treat student with no DOB as minor (age=0)", () => {
      // calculateAge should NOT be called when dob is null
      const result = resolvePaymentRecipient(
        makeStudent({ dob: null, student_email: "student@example.com" }),
        makeFamily({ father_email: "dad@example.com", father_name: "Dad" })
      );

      expect(mockCalculateAge).not.toHaveBeenCalled();
      expect(result.email).toBe("dad@example.com");
      expect(result.isStudent).toBe(false);
    });

    it("should treat student with undefined DOB as minor", () => {
      const result = resolvePaymentRecipient(
        makeStudent({ dob: undefined, student_email: "student@example.com" }),
        makeFamily({ father_email: "dad@example.com" })
      );

      expect(mockCalculateAge).not.toHaveBeenCalled();
      expect(result.isStudent).toBe(false);
    });

    it("should default primary_contact_type to father when not set", () => {
      mockCalculateAge.mockReturnValue(10);

      const result = resolvePaymentRecipient(
        makeStudent(),
        makeFamily({
          primary_contact_type: null,
          father_email: "father@example.com",
          father_name: "Father",
        })
      );

      expect(result.email).toBe("father@example.com");
      expect(result.name).toBe("Father");
    });

    it("should return student age 17 as minor", () => {
      mockCalculateAge.mockReturnValue(17);

      const result = resolvePaymentRecipient(
        makeStudent({ student_email: "teen@example.com" }),
        makeFamily({ father_email: "dad@example.com", father_name: "Dad" })
      );

      expect(result.email).toBe("dad@example.com");
      expect(result.isStudent).toBe(false);
    });
  });

  // =========================================================================
  // resolveRecipientWithFallback
  // =========================================================================

  describe("resolveRecipientWithFallback", () => {
    it("should return primary contact (father) when available", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: "father",
          father_email: "dad@example.com",
          father_name: "Dad",
        })
      );

      expect(result).toEqual({
        email: "dad@example.com",
        name: "Dad",
        isStudent: false,
      });
    });

    it("should return primary contact (mother) when available", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: "mother",
          mother_email: "mom@example.com",
          mother_name: "Mom",
        })
      );

      expect(result).toEqual({
        email: "mom@example.com",
        name: "Mom",
        isStudent: false,
      });
    });

    it("should fall back to secondary parent when primary has no email (father -> mother)", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: "father",
          father_email: null,
          father_name: null,
          mother_email: "mom@example.com",
          mother_name: "Mom",
        })
      );

      expect(result).toEqual({
        email: "mom@example.com",
        name: "Mom",
        isStudent: false,
      });
    });

    it("should fall back to secondary parent when primary has no email (mother -> father)", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: "mother",
          mother_email: null,
          mother_name: null,
          father_email: "dad@example.com",
          father_name: "Dad",
        })
      );

      expect(result).toEqual({
        email: "dad@example.com",
        name: "Dad",
        isStudent: false,
      });
    });

    it("should fall back to adult student email via callback when no parent email found", async () => {
      const findAdultStudentEmail = vi.fn().mockResolvedValue({
        email: "adult-student@example.com",
        name: "Adult Student",
      });

      const result = await resolveRecipientWithFallback(
        makeFamily({
          father_email: null,
          mother_email: null,
        }),
        findAdultStudentEmail
      );

      expect(findAdultStudentEmail).toHaveBeenCalled();
      expect(result).toEqual({
        email: "adult-student@example.com",
        name: "Adult Student",
        isStudent: true,
      });
    });

    it("should return error when no email found anywhere", async () => {
      const findAdultStudentEmail = vi.fn().mockResolvedValue(null);

      const result = await resolveRecipientWithFallback(
        makeFamily({
          father_email: null,
          mother_email: null,
        }),
        findAdultStudentEmail
      );

      expect(result.email).toBeNull();
      expect(result.name).toBeNull();
      expect(result.isStudent).toBe(false);
      expect(result.error).toBe(
        "No email address found for primary contact, secondary contact, or adult students in this family."
      );
    });

    it("should return error when no email found and no callback provided", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          father_email: null,
          mother_email: null,
        })
      );

      expect(result.email).toBeNull();
      expect(result.error).toBe(
        "No email address found for primary contact, secondary contact, or adult students in this family."
      );
    });

    it("should not call findAdultStudentEmail when primary contact has email", async () => {
      const findAdultStudentEmail = vi.fn();

      await resolveRecipientWithFallback(
        makeFamily({ father_email: "dad@example.com" }),
        findAdultStudentEmail
      );

      expect(findAdultStudentEmail).not.toHaveBeenCalled();
    });

    it("should not call findAdultStudentEmail when secondary contact has email", async () => {
      const findAdultStudentEmail = vi.fn();

      await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: "father",
          father_email: null,
          mother_email: "mom@example.com",
        }),
        findAdultStudentEmail
      );

      expect(findAdultStudentEmail).not.toHaveBeenCalled();
    });

    it("should default primary_contact_type to father when null", async () => {
      const result = await resolveRecipientWithFallback(
        makeFamily({
          primary_contact_type: null,
          father_email: "dad@example.com",
          father_name: "Dad",
        })
      );

      expect(result.email).toBe("dad@example.com");
      expect(result.name).toBe("Dad");
    });

    it("should handle findAdultStudentEmail returning null (no adult students)", async () => {
      const findAdultStudentEmail = vi.fn().mockResolvedValue(null);

      const result = await resolveRecipientWithFallback(
        makeFamily({ father_email: null, mother_email: null }),
        findAdultStudentEmail
      );

      expect(findAdultStudentEmail).toHaveBeenCalled();
      expect(result.email).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  // =========================================================================
  // formatError
  // =========================================================================

  describe("formatError", () => {
    it("should return Error.message for Error instances", () => {
      const error = new Error("Something went wrong");
      expect(formatError(error)).toBe("Something went wrong");
    });

    it("should return Error.message for Error subclass instances", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      expect(formatError(new CustomError("custom failure"))).toBe("custom failure");
    });

    it("should return stringified value for string input", () => {
      expect(formatError("string error")).toBe("string error");
    });

    it("should return stringified value for number input", () => {
      expect(formatError(42)).toBe("42");
    });

    it("should return stringified value for object input", () => {
      expect(formatError({ code: "ERR" })).toBe("[object Object]");
    });

    it("should return fallback message for falsy values that stringify to empty", () => {
      // String("") is "" which is falsy, so fallback is used
      expect(formatError("", "Fallback")).toBe("Fallback");
    });

    it("should use default fallback message when not specified", () => {
      expect(formatError("")).toBe("Unknown error occurred");
    });

    it("should return stringified value for boolean true", () => {
      expect(formatError(true)).toBe("true");
    });

    it("should return stringified value for boolean false", () => {
      expect(formatError(false)).toBe("false");
    });

    it("should return stringified null", () => {
      expect(formatError(null)).toBe("null");
    });

    it("should return stringified undefined", () => {
      expect(formatError(undefined)).toBe("undefined");
    });

    it("should return stringified zero", () => {
      expect(formatError(0)).toBe("0");
    });
  });

  // =========================================================================
  // isStripeConfigurationError
  // =========================================================================

  describe("isStripeConfigurationError", () => {
    it("should return true for error with 'configuration' in message", () => {
      const error = { message: "Stripe configuration is invalid" };
      expect(isStripeConfigurationError(error)).toBe(true);
    });

    it("should return true when 'configuration' appears anywhere in message", () => {
      const error = { message: "Missing account configuration for product" };
      expect(isStripeConfigurationError(error)).toBe(true);
    });

    it("should return false for error without 'configuration' in message", () => {
      const error = { message: "Payment failed due to insufficient funds" };
      expect(isStripeConfigurationError(error)).toBe(false);
    });

    it("should return false for error with no message property", () => {
      const error = { code: "some_error" };
      expect(isStripeConfigurationError(error)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isStripeConfigurationError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isStripeConfigurationError(undefined)).toBe(false);
    });

    it("should return false for a string", () => {
      expect(isStripeConfigurationError("configuration error")).toBe(false);
    });

    it("should return false for a number", () => {
      expect(isStripeConfigurationError(42)).toBe(false);
    });

    it("should return true for an Error instance with 'configuration' in message", () => {
      const error = new Error("Invalid Stripe configuration");
      expect(isStripeConfigurationError(error)).toBe(true);
    });

    it("should be case-sensitive (not match 'Configuration')", () => {
      const error = { message: "Configuration error" };
      // String.includes is case-sensitive, "Configuration" does not contain "configuration"
      expect(isStripeConfigurationError(error)).toBe(false);
    });
  });

  // =========================================================================
  // isStripeResourceMissingError
  // =========================================================================

  describe("isStripeResourceMissingError", () => {
    it("should return true for StripeInvalidRequestError with resource_missing code", () => {
      const error = {
        type: "StripeInvalidRequestError",
        code: "resource_missing",
        message: "No such customer: cus_xxx",
      };
      expect(isStripeResourceMissingError(error)).toBe(true);
    });

    it("should return false when type matches but code does not", () => {
      const error = {
        type: "StripeInvalidRequestError",
        code: "invalid_request",
      };
      expect(isStripeResourceMissingError(error)).toBe(false);
    });

    it("should return false when code matches but type does not", () => {
      const error = {
        type: "StripeCardError",
        code: "resource_missing",
      };
      expect(isStripeResourceMissingError(error)).toBe(false);
    });

    it("should return false for a standard Error instance", () => {
      const error = new Error("resource_missing");
      expect(isStripeResourceMissingError(error)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isStripeResourceMissingError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isStripeResourceMissingError(undefined)).toBe(false);
    });

    it("should return false for a string", () => {
      expect(isStripeResourceMissingError("StripeInvalidRequestError")).toBe(false);
    });

    it("should return false for an object with missing properties", () => {
      expect(isStripeResourceMissingError({})).toBe(false);
      expect(isStripeResourceMissingError({ type: "StripeInvalidRequestError" })).toBe(false);
      expect(isStripeResourceMissingError({ code: "resource_missing" })).toBe(false);
    });
  });

  // =========================================================================
  // Integration scenarios
  // =========================================================================

  describe("Integration scenarios", () => {
    beforeEach(() => {
      mockCalculateAge.mockReset();
      delete process.env.NEXT_PUBLIC_APP_DOMAIN;
      delete process.env.NEXT_PUBLIC_BASE_URL;
    });

    it("should build checkout URLs and resolve recipient for an adult student", () => {
      mockCalculateAge.mockReturnValue(20);

      const student = makeStudent({ student_email: "student@example.com", name: "Ali" });
      const family = makeFamily();

      const { successUrl, cancelUrl } = buildCheckoutUrls(
        "my-school",
        "/enroll",
        { success: "complete", cancelled: "cancelled" }
      );

      const recipient = resolvePaymentRecipient(student, family);

      expect(successUrl).toBe("https://my-school.amanahlogic.com/enroll?payment=complete");
      expect(cancelUrl).toBe("https://my-school.amanahlogic.com/enroll?payment=cancelled");
      expect(recipient.email).toBe("student@example.com");
      expect(recipient.isStudent).toBe(true);
    });

    it("should build checkout URLs and resolve recipient for a minor student", () => {
      mockCalculateAge.mockReturnValue(10);

      const student = makeStudent();
      const family = makeFamily({
        primary_contact_type: "mother",
        mother_email: "mom@school.com",
        mother_name: "Mom",
      });

      const { successUrl } = buildCheckoutUrls(
        "academy",
        "/pay",
        { success: "paid", cancelled: "back" }
      );

      const recipient = resolvePaymentRecipient(student, family);

      expect(successUrl).toBe("https://academy.amanahlogic.com/pay?payment=paid");
      expect(recipient.email).toBe("mom@school.com");
      expect(recipient.isStudent).toBe(false);
    });

    it("should format Stripe errors correctly and identify their types", () => {
      const configError = { message: "Invalid Stripe configuration for this account" };
      const resourceError = { type: "StripeInvalidRequestError", code: "resource_missing", message: "No such customer" };
      const genericError = new Error("Network timeout");

      expect(isStripeConfigurationError(configError)).toBe(true);
      expect(isStripeResourceMissingError(resourceError)).toBe(true);
      expect(formatError(genericError)).toBe("Network timeout");
    });
  });
});
