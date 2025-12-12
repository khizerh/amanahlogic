/**
 * Phone number utilities with international support.
 * Uses libphonenumber-js for validation and formatting.
 */
import {
  parsePhoneNumberWithError,
  isPossiblePhoneNumber as libIsPossible,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js/min";

/**
 * Validate phone number format for a specific country.
 * Uses isPossiblePhoneNumber which checks format and length,
 * but NOT whether the number is actually assigned/exists.
 * This is appropriate for admin tools where test data may be entered.
 *
 * @example
 * isValidPhoneForCountry('(555) 123-4567', 'US') → true
 * isValidPhoneForCountry('(234) 123-4123', 'US') → true (format is valid)
 * isValidPhoneForCountry('07700 900123', 'GB') → true
 * isValidPhoneForCountry('(416) 555-1234', 'CA') → true
 */
export function isValidPhoneForCountry(phone: string, country: CountryCode): boolean {
  if (!phone || !phone.trim()) return false;
  try {
    return libIsPossible(phone, country);
  } catch {
    return false;
  }
}

/**
 * Normalize phone to E.164 format for storage.
 * Uses isPossible() check (format/length only, not strict validity).
 * Throws on invalid format - callers must handle.
 *
 * @example
 * normalizePhoneForCountry('(555) 123-4567', 'US') → '+15551234567'
 * normalizePhoneForCountry('(234) 123-4123', 'US') → '+12341234123'
 * normalizePhoneForCountry('07700 900123', 'GB') → '+447700900123'
 * normalizePhoneForCountry('416-555-1234', 'CA') → '+14165551234'
 */
export function normalizePhoneForCountry(phone: string, country: CountryCode): string {
  const parsed = parsePhoneNumberWithError(phone, country);
  if (!parsed.isPossible()) {
    throw new Error(`Invalid phone number for ${country}: ${phone}`);
  }
  return parsed.format("E.164");
}

/**
 * Format phone for display in local format.
 * Returns original input if parsing fails (graceful degradation).
 *
 * @example
 * formatPhoneForCountry('+15551234567', 'US') → '(555) 123-4567'
 * formatPhoneForCountry('+447700900123', 'GB') → '07700 900123'
 */
export function formatPhoneForCountry(phone: string, country: CountryCode): string {
  if (!phone) return "";
  try {
    const parsed = parsePhoneNumberWithError(phone, country);
    return parsed.formatNational();
  } catch {
    return phone;
  }
}

/**
 * Format phone as-you-type for a specific country.
 * Adds formatting (parentheses, dashes, spaces) as user types.
 * Also limits input to valid length for the country.
 *
 * @example
 * formatPhoneAsYouType('555', 'US') → '(555'
 * formatPhoneAsYouType('5551234567', 'US') → '(555) 123-4567'
 * formatPhoneAsYouType('07700900', 'GB') → '07700 900'
 * formatPhoneAsYouType('416555', 'CA') → '(416) 555'
 */
export function formatPhoneAsYouType(input: string, country: CountryCode): string {
  if (!input) return "";
  const formatter = new AsYouType(country);
  return formatter.input(input);
}

/**
 * Get max phone length for a country (digits only).
 * Used to limit input field length.
 */
export function getMaxPhoneDigits(country: CountryCode): number {
  switch (country) {
    case "US":
    case "CA":
      return 10;
    case "GB":
      return 11; // UK numbers are 11 digits (including leading 0)
    default:
      return 15; // E.164 max
  }
}

// ============================================
// BACKWARD COMPATIBILITY - US-only functions
// Keep these for existing code that doesn't pass country
// ============================================

/**
 * Format a US phone number to (XXX) XXX-XXXX format for display
 * @deprecated Use formatPhoneForCountry(phone, country) for international support
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");

  // Remove leading +1 if present
  const cleanDigits = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;

  // Limit to 10 digits
  const limitedDigits = cleanDigits.slice(0, 10);

  // Format based on length
  if (limitedDigits.length === 0) return "";
  if (limitedDigits.length <= 3) return `(${limitedDigits}`;
  if (limitedDigits.length <= 6) {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  }
  return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
}

/**
 * Convert phone number to E.164 format for storage/API use
 * US numbers: +1XXXXXXXXXX
 * @deprecated Use normalizePhoneForCountry(phone, country) for international support
 */
export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  // If it starts with 1 and is 11 digits, assume it already has country code
  if (digits.startsWith("1") && digits.length === 11) {
    return `+${digits}`;
  }

  // Otherwise assume it's a 10-digit US number and add +1
  const tenDigits = digits.slice(0, 10);
  return tenDigits.length === 10 ? `+1${tenDigits}` : "";
}

/**
 * Check if a phone number is valid (10 digits for US)
 * @deprecated Use isValidPhoneForCountry(phone, country) for international support
 */
export function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  const cleanDigits = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  return cleanDigits.length === 10;
}
