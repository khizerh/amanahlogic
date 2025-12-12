/**
 * Validation utilities for international support
 */
import { SUPPORTED_COUNTRIES, SupportedCountry, SupportedCurrency } from "./countries";

// Valid values as Sets for O(1) lookup
const VALID_CURRENCIES = new Set<string>(["USD", "GBP", "CAD"]);
const VALID_COUNTRIES = new Set<string>(["US", "GB", "CA"]);

/**
 * Type guard for valid country codes
 */
export function isValidCountry(code: string | null | undefined): code is SupportedCountry {
  if (!code) return false;
  return VALID_COUNTRIES.has(code);
}

/**
 * Type guard for valid currency codes
 */
export function isValidCurrency(
  currency: string | null | undefined
): currency is SupportedCurrency {
  if (!currency) return false;
  return VALID_CURRENCIES.has(currency);
}

/**
 * Validate that a timezone string is valid using Intl.DateTimeFormat
 */
export function isValidTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that country and currency are aligned.
 * Each country has a required currency (US->USD, GB->GBP, CA->CAD).
 */
export function validateCountryCurrencyAlignment(
  country: string,
  currency: string
): { valid: boolean; expected?: SupportedCurrency } {
  if (!isValidCountry(country)) {
    return { valid: false };
  }
  const expected = SUPPORTED_COUNTRIES[country].currency;
  return {
    valid: currency === expected,
    expected,
  };
}

/**
 * Validate organization settings (country, currency, timezone)
 * Returns array of error messages (empty if valid)
 */
export function validateOrgSettings(data: {
  country?: string | null;
  currency?: string | null;
  timezone?: string | null;
}): string[] {
  const errors: string[] = [];

  if (data.country !== undefined && data.country !== null && !isValidCountry(data.country)) {
    errors.push(`Invalid country: ${data.country}. Must be one of: US, GB, CA`);
  }

  if (data.currency !== undefined && data.currency !== null && !isValidCurrency(data.currency)) {
    errors.push(`Invalid currency: ${data.currency}. Must be one of: USD, GBP, CAD`);
  }

  if (data.timezone !== undefined && data.timezone !== null && !isValidTimezone(data.timezone)) {
    errors.push(`Invalid timezone: ${data.timezone}`);
  }

  // Check alignment if both are provided
  if (data.country && data.currency) {
    const alignment = validateCountryCurrencyAlignment(data.country, data.currency);
    if (!alignment.valid && alignment.expected) {
      errors.push(
        `Currency ${data.currency} does not match country ${data.country} (expected ${alignment.expected})`
      );
    }
  }

  return errors;
}
