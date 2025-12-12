/**
 * Utility functions for handling currency/decimal values
 * Supabase returns DECIMAL fields as strings to preserve precision
 */

/**
 * Parse a decimal string or number to a number
 * Handles both database strings and form numbers
 */
export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a decimal value as currency.
 * Uses global org locale/currency if set on globalThis (for app-wide defaults),
 * otherwise falls back to USD/en-US for backward compatibility.
 */
export function formatCurrency(value: string | number | null | undefined): string {
  const num = parseDecimal(value);

  const globalCurrency =
    (typeof globalThis !== "undefined" &&
      (globalThis as unknown as { __orgCurrency?: string }).__orgCurrency) ||
    "USD";
  const globalLocale =
    (typeof globalThis !== "undefined" &&
      (globalThis as unknown as { __orgLocale?: string }).__orgLocale) ||
    "en-US";

  return num.toLocaleString(globalLocale, {
    style: "currency",
    currency: globalCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format amount with dynamic currency and locale
 * Use this for org-specific currency formatting
 *
 * @example
 * formatCurrencyWithLocale(100, 'USD', 'en-US') → "$100.00"
 * formatCurrencyWithLocale(100, 'GBP', 'en-GB') → "£100.00"
 * formatCurrencyWithLocale(100, 'CAD', 'en-CA') → "$100.00"
 */
export function formatCurrencyWithLocale(
  value: string | number | null | undefined,
  currency: string,
  locale: string
): string {
  const num = parseDecimal(value);
  return num.toLocaleString(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convert a number to a decimal string for database insert
 */
export function toDecimalString(value: number): string {
  return value.toFixed(2);
}

/**
 * Country to currency/locale mapping for pricing
 */
const COUNTRY_CONFIG: Record<string, { currency: string; locale: string; symbol: string }> = {
  US: { currency: "USD", locale: "en-US", symbol: "$" },
  GB: { currency: "GBP", locale: "en-GB", symbol: "£" },
  CA: { currency: "CAD", locale: "en-CA", symbol: "$" },
};

/**
 * Format a price amount for display based on organization's country.
 * Simpler API than formatCurrencyWithLocale - just pass country code.
 *
 * @param amount - The price amount
 * @param country - Country code (US, GB, CA)
 * @param options - Optional formatting options
 * @returns Formatted price string (e.g., "$99", "£69", "$129")
 *
 * @example
 * formatPrice(99, "US")  // "$99"
 * formatPrice(69, "GB")  // "£69"
 * formatPrice(99.50, "GB", { decimals: 2 }) // "£99.50"
 * formatPrice(149, "US", { compact: true }) // "$149"
 */
export function formatPrice(
  amount: number | string | null | undefined,
  country: string = "US",
  options?: { decimals?: number; compact?: boolean }
): string {
  const num = parseDecimal(amount);
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.US;

  // For whole numbers, don't show decimals unless explicitly requested
  const hasDecimals = options?.decimals !== undefined;
  const minDecimals = hasDecimals ? options.decimals : num % 1 === 0 ? 0 : 2;
  const maxDecimals = hasDecimals ? options.decimals : 2;

  return num.toLocaleString(config.locale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Get the currency symbol for a country
 *
 * @param country - Country code (US, GB, CA)
 * @returns Currency symbol ($, £)
 *
 * @example
 * getCurrencySymbol("US") // "$"
 * getCurrencySymbol("GB") // "£"
 */
export function getCurrencySymbol(country: string = "US"): string {
  return COUNTRY_CONFIG[country]?.symbol || "$";
}

/**
 * Get the currency code for a country (lowercase for Stripe)
 *
 * @param country - Country code (US, GB, CA)
 * @returns Currency code in lowercase (usd, gbp, cad)
 *
 * @example
 * getStripeCurrency("US") // "usd"
 * getStripeCurrency("GB") // "gbp"
 */
export function getStripeCurrency(country: string = "US"): string {
  return (COUNTRY_CONFIG[country]?.currency || "USD").toLowerCase();
}

/**
 * Approximate exchange rates to USD for revenue reporting
 * These are rough estimates - update periodically for accuracy
 * Used only for super-admin dashboard aggregation
 */
const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  GBP: 1.27, // 1 GBP ≈ 1.27 USD
  CAD: 0.74, // 1 CAD ≈ 0.74 USD
};

/**
 * Convert an amount from a given currency to USD
 * Used for aggregating revenue across different currency organizations
 *
 * @param amount - The amount in source currency
 * @param currency - Source currency code (USD, GBP, CAD)
 * @returns Amount converted to USD
 *
 * @example
 * convertToUSD(100, "GBP") // 127 (100 GBP ≈ $127 USD)
 * convertToUSD(100, "CAD") // 74 (100 CAD ≈ $74 USD)
 * convertToUSD(100, "USD") // 100
 */
export function convertToUSD(amount: number, currency: string = "USD"): number {
  const rate = USD_EXCHANGE_RATES[currency] || 1.0;
  return amount * rate;
}

/**
 * Get the exchange rate for a currency to USD
 *
 * @param currency - Currency code (USD, GBP, CAD)
 * @returns Exchange rate to USD
 */
export function getUSDExchangeRate(currency: string = "USD"): number {
  return USD_EXCHANGE_RATES[currency] || 1.0;
}
