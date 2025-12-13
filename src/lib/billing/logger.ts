/**
 * Billing Engine Logger
 *
 * Structured logging utility for billing operations.
 * Outputs JSON-formatted logs for easy querying and monitoring.
 */

import { logger as baseLogger } from "@/lib/logger";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: unknown;
}

/**
 * Structured logger for billing operations
 *
 * Outputs JSON-formatted logs with timestamps and context.
 * In production, these should be sent to a logging service like Sentry or LogDNA.
 */
class BillingLogger {
  private prefix = "[BILLING]";

  /**
   * Core logging method that formats and outputs structured logs
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    // In production, send to logging service (e.g., Sentry, LogDNA)
    // For now, use base logger with structured format
    switch (level) {
      case "error":
        baseLogger.error(`${this.prefix} ${message}`, context);
        break;
      case "warn":
        baseLogger.warn(`${this.prefix} ${message}`, context);
        break;
      case "debug":
        baseLogger.debug(`${this.prefix} ${message}`, context);
        break;
      case "info":
      default:
        baseLogger.info(`${this.prefix} ${message}`, context);
    }
  }

  /**
   * Log informational message
   *
   * @param message - Human-readable message
   * @param context - Additional structured data
   *
   * @example
   * logger.info('payment_created', {
   *   invoice_number: 'INV-AL-202501-0001',
   *   amount: 150.00
   * });
   */
  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  /**
   * Log warning message
   *
   * @param message - Human-readable message
   * @param context - Additional structured data
   *
   * @example
   * logger.warn('membership_skipped_duplicate', {
   *   membership_id: '123',
   *   reason: 'payment_already_exists'
   * });
   */
  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  /**
   * Log error message
   *
   * @param message - Human-readable message
   * @param context - Additional structured data including error details
   *
   * @example
   * logger.error('payment_creation_failed', {
   *   membership_id: '123',
   *   error: error.message
   * });
   */
  error(message: string, context?: LogContext) {
    this.log("error", message, context);
  }

  /**
   * Log debug message (only shown in debug mode)
   *
   * @param message - Human-readable message
   * @param context - Additional structured data
   *
   * @example
   * logger.debug('dry_run_would_create_payment', {
   *   membership_id: '123',
   *   amount: 150.00
   * });
   */
  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }
}

/**
 * Singleton logger instance for billing operations
 */
export const logger = new BillingLogger();
