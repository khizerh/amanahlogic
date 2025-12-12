/**
 * Error Handling Utilities
 *
 * Comprehensive error handling system integrated with structured logging.
 * Works both server-side and client-side for Next.js applications.
 *
 * @example
 * ```typescript
 * import { handleError, withErrorHandling, AppError, ERROR_CODES } from '@/lib/utils/error-handling';
 *
 * // Using handleError
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   handleError(error, {
 *     showNotification: true,
 *     context: { userId: '123' }
 *   });
 * }
 *
 * // Using withErrorHandling wrapper
 * const safeFunction = withErrorHandling(
 *   async () => {
 *     return await riskyOperation();
 *   },
 *   { context: { operation: 'user_creation' } }
 * );
 * ```
 */

/**
 * Standard error codes used throughout the application
 */
export enum ERROR_CODES {
  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Authentication & Authorization errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Database errors
  DATABASE_ERROR = "DATABASE_ERROR",
  QUERY_FAILED = "QUERY_FAILED",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",

  // Payment & Stripe errors
  STRIPE_ERROR = "STRIPE_ERROR",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
  SUBSCRIPTION_ERROR = "SUBSCRIPTION_ERROR",
  INVOICE_ERROR = "INVOICE_ERROR",

  // Email errors
  EMAIL_ERROR = "EMAIL_ERROR",
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",
  INVALID_EMAIL = "INVALID_EMAIL",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",

  // File & Upload errors
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  UPLOAD_FAILED = "UPLOAD_FAILED",

  // General errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

/**
 * Context for logging errors
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Options for error handling
 */
export interface ErrorHandlingOptions {
  /**
   * Whether to show a user-facing notification
   * @default false
   */
  showNotification?: boolean;

  /**
   * Additional context for logging
   */
  context?: ErrorContext;

  /**
   * Whether to rethrow the error after handling
   * @default false
   */
  rethrow?: boolean;

  /**
   * Log level override
   * @default 'error'
   */
  logLevel?: "info" | "warn" | "error" | "debug";

  /**
   * Custom notification message (overrides error message)
   */
  notificationMessage?: string;
}

/**
 * Custom application error class with proper typing
 */
export class AppError extends Error {
  public readonly code: ERROR_CODES;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ERROR_CODES = ERROR_CODES.INTERNAL_ERROR,
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Factory for creating typed application errors
 */
export class AppErrorFactory {
  /**
   * Create a validation error
   */
  static validation(message: string, context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.VALIDATION_ERROR, 400, context);
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string, context?: ErrorContext): AppError {
    return new AppError(`${resource} not found`, ERROR_CODES.NOT_FOUND, 404, context);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string = "Unauthorized", context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.UNAUTHORIZED, 401, context);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = "Forbidden", context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.FORBIDDEN, 403, context);
  }

  /**
   * Create a database error
   */
  static database(message: string, context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.DATABASE_ERROR, 500, context);
  }

  /**
   * Create a Stripe/payment error
   */
  static stripe(message: string, context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.STRIPE_ERROR, 500, context);
  }

  /**
   * Create an email error
   */
  static email(message: string, context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.EMAIL_ERROR, 500, context);
  }

  /**
   * Create a network error
   */
  static network(message: string, context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.NETWORK_ERROR, 503, context);
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(message: string = "Rate limit exceeded", context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429, context);
  }

  /**
   * Create a generic internal error
   */
  static internal(message: string = "Internal server error", context?: ErrorContext): AppError {
    return new AppError(message, ERROR_CODES.INTERNAL_ERROR, 500, context, false);
  }
}

/**
 * Logger interface - compatible with custom logger implementations
 * Falls back to console if logger is not available
 */
interface Logger {
  info(message: string, context?: ErrorContext): void;
  warn(message: string, context?: ErrorContext): void;
  error(message: string, context?: ErrorContext): void;
  debug(message: string, context?: ErrorContext): void;
}

/**
 * Default console-based logger
 */
class ConsoleLogger implements Logger {
  private formatLog(level: string, message: string, context?: ErrorContext) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };
    return JSON.stringify(logData);
  }

  info(message: string, context?: ErrorContext) {
    // Using console as fallback logger - should be replaced via setLogger()
    console.log(`[INFO] ${this.formatLog("info", message, context)}`);
  }

  warn(message: string, context?: ErrorContext) {
    console.warn(`[WARN] ${this.formatLog("warn", message, context)}`);
  }

  error(message: string, context?: ErrorContext) {
    console.error(`[ERROR] ${this.formatLog("error", message, context)}`);
  }

  debug(message: string, context?: ErrorContext) {
    // Using console as fallback logger - should be replaced via setLogger()
    console.log(`[DEBUG] ${this.formatLog("debug", message, context)}`);
  }
}

/**
 * Global logger instance
 * Can be replaced with a custom logger via setLogger()
 */
let globalLogger: Logger = new ConsoleLogger();

/**
 * Set a custom logger instance
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 * import { setLogger } from '@/lib/utils/error-handling';
 *
 * setLogger(logger);
 * ```
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Get the current logger instance
 */
export function getLogger(): Logger {
  return globalLogger;
}

/**
 * Extract error information from unknown error types
 */
function extractErrorInfo(error: unknown): {
  message: string;
  code?: ERROR_CODES;
  statusCode?: number;
  context?: ErrorContext;
  stack?: string;
} {
  // AppError
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
      stack: error.stack,
    };
  }

  // Standard Error
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  // String error
  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  // Object with message
  if (error && typeof error === "object" && "message" in error) {
    return {
      message: String(error.message),
      context: error as ErrorContext,
    };
  }

  // Unknown error type
  return {
    message: "An unknown error occurred",
    context: { error: String(error) },
  };
}

/**
 * Main error handling function
 *
 * Logs the error with context and optionally shows a notification.
 * This function should be your go-to for handling errors consistently.
 *
 * @param error - The error to handle
 * @param options - Error handling options
 *
 * @example
 * ```typescript
 * try {
 *   await createUser(userData);
 * } catch (error) {
 *   handleError(error, {
 *     showNotification: true,
 *     context: { userId: userData.id, operation: 'user_creation' }
 *   });
 * }
 * ```
 */
export function handleError(error: unknown, options: ErrorHandlingOptions = {}): void {
  const {
    showNotification = false,
    context = {},
    rethrow = false,
    logLevel = "error",
    notificationMessage,
  } = options;

  const errorInfo = extractErrorInfo(error);

  // Merge contexts
  const fullContext: ErrorContext = {
    ...errorInfo.context,
    ...context,
    ...(errorInfo.code && { code: errorInfo.code }),
    ...(errorInfo.statusCode && { statusCode: errorInfo.statusCode }),
    ...(errorInfo.stack && { stack: errorInfo.stack }),
  };

  // Log the error
  const logger = getLogger();
  const logMessage = errorInfo.message;

  switch (logLevel) {
    case "info":
      logger.info(logMessage, fullContext);
      break;
    case "warn":
      logger.warn(logMessage, fullContext);
      break;
    case "debug":
      logger.debug(logMessage, fullContext);
      break;
    case "error":
    default:
      logger.error(logMessage, fullContext);
  }

  // Show notification if requested
  if (showNotification) {
    const message = notificationMessage || errorInfo.message;
    // In a real app, this would integrate with your toast/notification system
    // For now, we'll just log it
    logger.warn(`[NOTIFICATION] ${message}`, { context: "error-handling", notification: true });
  }

  // Rethrow if requested
  if (rethrow) {
    throw error;
  }
}

/**
 * Wrapper for async functions that automatically handles errors
 *
 * @param fn - The async function to wrap
 * @param options - Error handling options
 * @returns A new function that catches and handles errors
 *
 * @example
 * ```typescript
 * const safeCreateUser = withErrorHandling(
 *   async (userData: UserInput) => {
 *     return await db.users.create(userData);
 *   },
 *   {
 *     showNotification: true,
 *     context: { operation: 'user_creation' }
 *   }
 * );
 *
 * // Usage
 * const result = await safeCreateUser(userData);
 * // Errors are automatically caught and handled
 * ```
 */
export function withErrorHandling<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: ErrorHandlingOptions = {}
): (...args: TArgs) => Promise<TReturn | null> {
  return async (...args: TArgs): Promise<TReturn | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, options);
      return null;
    }
  };
}

/**
 * Wrapper for async functions that returns a result object instead of throwing
 * Useful for functions where you want to handle success/error cases explicitly
 *
 * @param fn - The async function to wrap
 * @returns A new function that returns { success, data?, error? }
 *
 * @example
 * ```typescript
 * const createUser = withErrorResult(async (userData: UserInput) => {
 *   return await db.users.create(userData);
 * });
 *
 * const result = await createUser(userData);
 * if (result.success) {
 *   console.log('User created:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export function withErrorResult<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (
  ...args: TArgs
) => Promise<
  { success: true; data: TReturn } | { success: false; error: string; code?: ERROR_CODES }
> {
  return async (
    ...args: TArgs
  ): Promise<
    { success: true; data: TReturn } | { success: false; error: string; code?: ERROR_CODES }
  > => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      return {
        success: false,
        error: errorInfo.message,
        ...(errorInfo.code && { code: errorInfo.code }),
      };
    }
  };
}

/**
 * Async error boundary for server components
 * Catches errors and renders a fallback
 *
 * @param fn - The async function to execute
 * @param fallback - Fallback value if error occurs
 * @param options - Error handling options
 *
 * @example
 * ```typescript
 * export default async function Page() {
 *   const data = await asyncErrorBoundary(
 *     () => fetchData(),
 *     { users: [] },
 *     { context: { page: 'users' } }
 *   );
 *
 *   return <UserList users={data.users} />;
 * }
 * ```
 */
export async function asyncErrorBoundary<T>(
  fn: () => Promise<T>,
  fallback: T,
  options: ErrorHandlingOptions = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, options);
    return fallback;
  }
}

/**
 * Error utilities for common scenarios
 */
export const ErrorUtils = {
  /**
   * Check if error is a specific error code
   */
  isErrorCode(error: unknown, code: ERROR_CODES): boolean {
    return isAppError(error) && error.code === code;
  },

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: unknown): string {
    const errorInfo = extractErrorInfo(error);

    // Map technical errors to user-friendly messages
    const userMessages: Partial<Record<ERROR_CODES, string>> = {
      [ERROR_CODES.VALIDATION_ERROR]: "Please check your input and try again.",
      [ERROR_CODES.NOT_FOUND]: "The requested resource was not found.",
      [ERROR_CODES.UNAUTHORIZED]: "Please sign in to continue.",
      [ERROR_CODES.FORBIDDEN]: "You do not have permission to perform this action.",
      [ERROR_CODES.DATABASE_ERROR]: "A database error occurred. Please try again later.",
      [ERROR_CODES.STRIPE_ERROR]: "A payment error occurred. Please try again.",
      [ERROR_CODES.EMAIL_ERROR]: "Failed to send email. Please try again.",
      [ERROR_CODES.NETWORK_ERROR]: "Network error. Please check your connection.",
      [ERROR_CODES.RATE_LIMIT_EXCEEDED]: "Too many requests. Please try again later.",
    };

    if (errorInfo.code && userMessages[errorInfo.code]) {
      return userMessages[errorInfo.code]!;
    }

    return errorInfo.message || "An unexpected error occurred.";
  },

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (!isAppError(error)) return false;

    const retryableCodes = [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT_ERROR,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      ERROR_CODES.DATABASE_ERROR,
    ];

    return retryableCodes.includes(error.code);
  },
};
