// Country configuration
export {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  getLocaleForCountry,
  getCurrencyForCountry,
  getCountryFromCurrency,
  type SupportedCountry,
  type SupportedCurrency,
} from "./countries";

// Validation utilities
export {
  isValidCountry,
  isValidCurrency,
  isValidTimezone,
  validateCountryCurrencyAlignment,
  validateOrgSettings,
} from "./validation";

// Phone utilities
export {
  // International (recommended)
  isValidPhoneForCountry,
  normalizePhoneForCountry,
  formatPhoneForCountry,
  formatPhoneAsYouType,
  getMaxPhoneDigits,
  // Legacy US-only (deprecated)
  formatPhoneNumber,
  normalizePhoneNumber,
  isValidPhoneNumber,
} from "./phone";

// Currency utilities
export {
  parseDecimal,
  formatCurrency,
  formatCurrencyWithLocale,
  toDecimalString,
  formatPrice,
  getCurrencySymbol,
  getStripeCurrency,
  convertToUSD,
  getUSDExchangeRate,
} from "./currency";

// Date formatting utilities
export {
  formatShortDateWithLocale,
  formatMediumDateWithLocale,
  formatDateTimeWithLocale,
  formatNumericDateTimeWithLocale,
  formatFullDateWithLocale,
  formatDateWithLocale,
  parseLocalDate,
  calculateAge,
} from "./date";

// Error handling utilities
export {
  ERROR_CODES,
  AppError,
  AppErrorFactory,
  ErrorUtils,
  handleError,
  withErrorHandling,
  withErrorResult,
  asyncErrorBoundary,
  setLogger,
  getLogger,
  isAppError,
  type ErrorContext,
  type ErrorHandlingOptions,
} from "./error-handling";
