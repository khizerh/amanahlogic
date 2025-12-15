/**
 * Payment operations module
 * @module lib/payments
 *
 * This module contains the business logic for payment operations.
 *
 * Note: Advanced payment features (onboarding, customer portal, payment links, receipts, refunds)
 * are in _disabled/ folder until supporting modules are built:
 * - @/lib/stripe (Stripe integration)
 * - @/lib/billing (billing calculations)
 * - @/lib/email (email queue)
 * - @/lib/database (database services)
 */

// Types
export * from "./types";

// Utils
export {
  getOrgBaseUrl,
  buildCheckoutUrls,
  resolvePaymentRecipient,
  resolveRecipientWithFallback,
  formatError,
  isStripeConfigurationError,
  isStripeResourceMissingError,
} from "./utils";
