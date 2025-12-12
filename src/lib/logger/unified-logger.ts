/**
 * Unified Logger
 *
 * Environment-aware logging system with:
 * - Structured logging with metadata
 * - Context/category support
 * - Performance timing utilities
 * - Memory leak protection
 * - Production-safe defaults
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = string;

export interface LogMetadata {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  context?: LogContext;
}

export interface LoggerOptions {
  /**
   * Environment mode
   * @default process.env.NODE_ENV || 'development'
   */
  environment?: "development" | "production";

  /**
   * Minimum log level to output
   * @default 'debug' in development, 'warn' in production
   */
  minLevel?: LogLevel;

  /**
   * Enable/disable colored output (development only)
   * @default true
   */
  enableColors?: boolean;

  /**
   * Maximum number of log entries to keep in memory (development only)
   * Prevents memory leaks during development
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Custom log handler
   * Useful for sending logs to external services
   */
  onLog?: (entry: LogEntry) => void;

  /**
   * Whether this logger is for client-side use
   * Client loggers avoid server-only APIs
   * @default false
   */
  isClient?: boolean;
}

export interface TimerEnd {
  (): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI color codes for terminal output
const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  context: "\x1b[35m", // Magenta
  timestamp: "\x1b[90m", // Gray
};

export class UnifiedLogger {
  private options: Required<LoggerOptions>;
  private logHistory: LogEntry[] = [];
  private timers: Map<string, number> = new Map();

  constructor(options: LoggerOptions = {}) {
    const isDevelopment =
      options.environment === "development" ||
      (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");

    this.options = {
      environment: isDevelopment ? "development" : "production",
      minLevel: options.minLevel || (isDevelopment ? "debug" : "warn"),
      enableColors: options.enableColors ?? true,
      maxEntries: options.maxEntries ?? 1000,
      onLog: options.onLog || (() => {}),
      isClient: options.isClient ?? false,
    };
  }

  /**
   * Log a debug message
   * Only logs in development by default
   */
  debug(message: string, metadata?: LogMetadata, context?: LogContext): void {
    this.log("debug", message, metadata, context);
  }

  /**
   * Log an info message
   * Only logs in development by default
   */
  info(message: string, metadata?: LogMetadata, context?: LogContext): void {
    this.log("info", message, metadata, context);
  }

  /**
   * Log a warning message
   * Logs in all environments
   */
  warn(message: string, metadata?: LogMetadata, context?: LogContext): void {
    this.log("warn", message, metadata, context);
  }

  /**
   * Log an error message
   * Logs in all environments
   */
  error(message: string, metadata?: LogMetadata, context?: LogContext): void {
    this.log("error", message, metadata, context);
  }

  /**
   * Start a performance timer
   * Returns a function that when called, logs the elapsed time
   *
   * @example
   * const endTimer = logger.time("Database query", "database");
   * await db.query(...);
   * endTimer(); // Logs: "Database query completed in 123ms"
   */
  time(label: string, context?: LogContext): TimerEnd {
    const startTime = this.getTime();
    const timerId = `${label}-${startTime}`;
    this.timers.set(timerId, startTime);

    return () => {
      const endTime = this.getTime();
      const duration = endTime - startTime;
      this.timers.delete(timerId);

      this.info(
        `${label} completed in ${duration}ms`,
        { duration, label },
        context || "performance"
      );
    };
  }

  /**
   * Clear log history (development only)
   * Useful for testing or preventing memory buildup
   */
  clear(): void {
    if (this.options.environment === "development") {
      this.logHistory = [];
    }
  }

  /**
   * Get log history (development only)
   */
  getHistory(): LogEntry[] {
    return this.options.environment === "development" ? [...this.logHistory] : [];
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    // Check if we should log based on minimum level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      context,
    };

    // Store in history (development only, with memory protection)
    if (this.options.environment === "development") {
      this.logHistory.push(entry);

      // Prevent memory leaks by limiting history size
      if (this.logHistory.length > this.options.maxEntries) {
        this.logHistory.shift();
      }
    }

    // Output to console
    this.output(entry);

    // Call custom handler if provided
    this.options.onLog(entry);
  }

  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    const { level, message, metadata, context, timestamp } = entry;

    if (this.options.environment === "production") {
      // Production: Structured JSON logging
      console[level === "debug" ? "log" : level](
        JSON.stringify({
          timestamp,
          level,
          message,
          context,
          ...metadata,
        })
      );
    } else {
      // Development: Pretty colored output
      const useColors = this.options.enableColors && !this.options.isClient;

      const parts: string[] = [];

      // Timestamp
      if (useColors) {
        parts.push(`${COLORS.timestamp}[${this.formatTimestamp(timestamp)}]${COLORS.reset}`);
      } else {
        parts.push(`[${this.formatTimestamp(timestamp)}]`);
      }

      // Level
      if (useColors) {
        const color = COLORS[level];
        parts.push(`${color}[${level.toUpperCase()}]${COLORS.reset}`);
      } else {
        parts.push(`[${level.toUpperCase()}]`);
      }

      // Context
      if (context) {
        if (useColors) {
          parts.push(`${COLORS.context}[${context}]${COLORS.reset}`);
        } else {
          parts.push(`[${context}]`);
        }
      }

      // Message
      parts.push(message);

      const output = parts.join(" ");

      // Log to console
      if (metadata && Object.keys(metadata).length > 0) {
        console[level === "debug" ? "log" : level](output, metadata);
      } else {
        console[level === "debug" ? "log" : level](output);
      }
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const time = date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  /**
   * Get current time in milliseconds
   * Uses performance.now() if available (more accurate), otherwise Date.now()
   */
  private getTime(): number {
    if (!this.options.isClient && typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options?: LoggerOptions): UnifiedLogger {
  return new UnifiedLogger(options);
}
