/**
 * Supported countries configuration
 * Each country has its currency, locale for formatting, and phone example
 */
export const SUPPORTED_COUNTRIES = {
  US: {
    currency: "USD",
    locale: "en-US",
    phoneExample: "(555) 123-4567",
  },
  GB: {
    currency: "GBP",
    locale: "en-GB",
    phoneExample: "07700 900123",
  },
  CA: {
    currency: "CAD",
    locale: "en-CA",
    phoneExample: "(416) 555-1234",
  },
} as const;

export type SupportedCountry = keyof typeof SUPPORTED_COUNTRIES;
export type SupportedCurrency = "USD" | "GBP" | "CAD";

/**
 * Get configuration for a supported country
 */
export function getCountryConfig(country: SupportedCountry) {
  return SUPPORTED_COUNTRIES[country];
}

/**
 * Get locale for a country code
 */
export function getLocaleForCountry(country: string): string {
  return SUPPORTED_COUNTRIES[country as SupportedCountry]?.locale || "en-US";
}

/**
 * Get currency for a country code
 */
export function getCurrencyForCountry(country: string): SupportedCurrency {
  return SUPPORTED_COUNTRIES[country as SupportedCountry]?.currency || "USD";
}

/**
 * Currency to country mapping (reverse of country->currency)
 */
const CURRENCY_TO_COUNTRY: Record<SupportedCurrency, SupportedCountry> = {
  USD: "US",
  GBP: "GB",
  CAD: "CA",
};

/**
 * Get country from currency code
 * Used when we need to derive country for phone formatting, etc.
 */
export function getCountryFromCurrency(currency: string): SupportedCountry {
  return CURRENCY_TO_COUNTRY[currency as SupportedCurrency] || "US";
}
