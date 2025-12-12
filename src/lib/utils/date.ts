import { getLocaleForCountry, type SupportedCountry } from "./countries";

interface DateFormatOptions {
  country: SupportedCountry | string;
  timezone?: string;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateValue(value: string | Date): Date {
  if (value instanceof Date) return value;

  // Anchor DATE-only strings at noon to prevent UTC midnight shifting the day in US timezones
  if (DATE_ONLY_REGEX.test(value)) {
    return new Date(`${value}T12:00:00`);
  }

  return new Date(value);
}

/**
 * Format a date string or Date object to a short date format (e.g., "Jan 15, 2025")
 * Uses the locale appropriate for the given country.
 */
export function formatShortDateWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Format a date string or Date object to a medium date format (e.g., "January 15, 2025")
 * Uses the locale appropriate for the given country.
 */
export function formatMediumDateWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Format a date string or Date object to include date and time (text month)
 * Uses the locale appropriate for the given country.
 * Example: "Nov 25, 2025, 3:45 PM" (US) or "25 Nov 2025, 15:45" (GB)
 */
export function formatDateTimeWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Format a date string or Date object to include date and time (numeric)
 * Uses the locale appropriate for the given country.
 * Example: "11/25/2025, 3:45 PM" (US) or "25/11/2025, 15:45" (GB)
 */
export function formatNumericDateTimeWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Format a date string or Date object to a full date format with weekday
 * Uses the locale appropriate for the given country.
 * Example: "Monday, January 15, 2025" (US) or "Monday, 15 January 2025" (GB)
 */
export function formatFullDateWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Format a date string or Date object to a simple date format (e.g., "1/15/2025" or "15/01/2025")
 * Uses the locale appropriate for the given country.
 *
 * IMPORTANT: For YYYY-MM-DD date strings (DATE columns), this function parses using
 * component extraction to avoid the timezone shift bug where `new Date("2025-01-01")`
 * parses as midnight UTC and shifts to Dec 31 in US timezones.
 */
export function formatDateWithLocale(
  value: string | Date | null | undefined,
  options: DateFormatOptions
): string {
  if (!value) return "—";

  const date = parseDateValue(value);
  if (isNaN(date.getTime())) return "—";

  const locale = getLocaleForCountry(options.country as SupportedCountry);

  return date.toLocaleDateString(locale, {
    timeZone: options.timezone || "UTC",
  });
}

/**
 * Parse a YYYY-MM-DD date string without timezone shifting.
 *
 * CRITICAL: Using `new Date("2025-01-01")` parses as midnight UTC, which shifts
 * to Dec 31 in US timezones. This function parses as local midnight instead.
 *
 * Use this for:
 * - Date-only columns from the database (DATE type, not TIMESTAMPTZ)
 * - DOB, enrolled_date, billing dates, etc.
 * - Any YYYY-MM-DD string that should represent a calendar date
 *
 * @example
 * // In PST (UTC-8), midnight UTC is 4pm previous day
 * new Date("2025-01-01")           // Dec 31, 2024 4:00 PM PST ❌
 * parseLocalDate("2025-01-01")     // Jan 1, 2025 12:00 AM PST ✅
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate age from a date of birth string.
 * Uses parseLocalDate internally to avoid timezone issues.
 *
 * @example
 * calculateAge("2000-01-15") // Returns age in years
 */
export function calculateAge(dob: string): number {
  const birthDate = parseLocalDate(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
