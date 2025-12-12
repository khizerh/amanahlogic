/**
 * Server-side logger export
 *
 * This is the default export for server-side usage.
 * It has access to all Node.js APIs and full logging capabilities.
 *
 * @example
 * ```typescript
 * import { logger } from '@imarah/logger';
 *
 * logger.info("User logged in", { userId: "123" }, "auth");
 * logger.error("Failed to save", { error, draftId }, "database");
 *
 * const endTimer = logger.time("Database query", "database");
 * await db.query(...);
 * endTimer();
 * ```
 */

import { createLogger } from "./unified-logger";

// Create a singleton logger instance for server-side use
export const logger = createLogger({
  isClient: false,
});

// Export types for consumers
export type {
  LogLevel,
  LogContext,
  LogMetadata,
  LogEntry,
  LoggerOptions,
  TimerEnd,
} from "./unified-logger";

// Export the logger class for custom instances
export { UnifiedLogger, createLogger } from "./unified-logger";
