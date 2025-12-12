/**
 * Billing Engine for Burial Benefits
 *
 * Exports all billing-related functionality including:
 * - Core billing engine (processRecurringBilling, processAllOrganizationsBilling)
 * - Invoice number generation
 * - Billing logger
 *
 * @example
 * import { processRecurringBilling, logger } from '@/lib/billing';
 *
 * // Process billing for an organization
 * const result = await processRecurringBilling('org-123');
 *
 * // Dry run
 * const result = await processRecurringBilling('org-123', { dryRun: true });
 */

// Core billing engine
export {
  processRecurringBilling,
  processAllOrganizationsBilling,
  type BillingOptions,
  type BillingRunResult,
} from "./engine";

// Invoice generation utilities
export {
  generateInvoiceNumber,
  calculateNextBillingDate,
  formatPeriodLabel,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
} from "./invoice-generator";

// Logger
export { logger } from "./logger";

// Types
export * from "./types";
