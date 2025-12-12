/**
 * Payment operations module
 * @module lib/payments
 *
 * This module contains the business logic for payment operations.
 * Actions in app/actions/payments.ts should call these functions.
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

// Refund
export { processRefund } from "./refund";
export type { RefundPaymentParams, RefundResult } from "./refund";

// Payment Link
export {
  generatePaymentLinkLogic,
  regeneratePaymentLinkLogic,
  getPaymentLinkUrlLogic,
} from "./payment-link";
export type {
  GeneratePaymentLinkParams,
  PaymentLinkResult,
  RegeneratePaymentLinkParams,
  GetPaymentLinkUrlParams,
  GetPaymentLinkUrlResult,
} from "./payment-link";

// Payment Link Helpers (re-exported for convenience)
export type { EnrollmentQueryResult } from "./payment-link-helpers";

// Auto-pay
export { createAutoPayCheckoutLinkLogic } from "./auto-pay";
export type { CreateAutoPayCheckoutLinkParams, AutoPayCheckoutLinkResult } from "./auto-pay";

// Customer Portal
export {
  sendCustomerPortalLinkLogic,
  generateCustomerPortalLinkLogic,
  handlePortalError,
} from "./customer-portal";
export type {
  SendCustomerPortalLinkParams,
  GenerateCustomerPortalLinkParams,
  CustomerPortalLinkResult,
} from "./customer-portal";

// Receipt
export {
  sendReceiptEmailLogic,
  queuePaymentReceiptEmail,
  queueInvoiceEmailForPayment,
} from "./receipt";
export type { SendReceiptEmailParams, SendReceiptEmailResult } from "./receipt";
