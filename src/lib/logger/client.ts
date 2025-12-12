/**
 * Client-side logger export
 *
 * This is the client-safe export for browser/Next.js client components.
 * It avoids server-only APIs and is safe to use in React Client Components.
 *
 * @example
 * ```typescript
 * import { logger } from '@imarah/logger/client';
 *
 * logger.info("User clicked button", { buttonId: "submit" }, "ui");
 * logger.error("Failed to submit form", { error }, "forms");
 *
 * const endTimer = logger.time("API request", "api");
 * await fetch(...);
 * endTimer();
 * ```
 */

import { createLogger } from "./unified-logger";

// Create a singleton logger instance for client-side use
export const logger = createLogger({
  isClient: true,
  // Client-side logging is more conservative
  // Only warn and error by default to avoid console spam
  minLevel: process.env.NODE_ENV === "production" ? "warn" : "debug",
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
