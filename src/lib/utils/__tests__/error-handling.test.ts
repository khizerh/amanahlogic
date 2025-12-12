/**
 * Error Handling Utilities Tests
 *
 * Comprehensive tests for error handling, logging, and error wrapping functions.
 * These utilities are critical for consistent error management across the entire system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ERROR_CODES,
  AppError,
  AppErrorFactory,
  isAppError,
  setLogger,
  getLogger,
  handleError,
  withErrorHandling,
  withErrorResult,
  asyncErrorBoundary,
  ErrorUtils,
  type ErrorContext,
  type ErrorHandlingOptions,
} from "../error-handling";

describe("Error Handling Utilities", () => {
  describe("ERROR_CODES enum", () => {
    it("should have all validation error codes", () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
      expect(ERROR_CODES.INVALID_INPUT).toBe("INVALID_INPUT");
      expect(ERROR_CODES.MISSING_REQUIRED_FIELD).toBe("MISSING_REQUIRED_FIELD");
    });

    it("should have all resource error codes", () => {
      expect(ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
      expect(ERROR_CODES.RESOURCE_NOT_FOUND).toBe("RESOURCE_NOT_FOUND");
      expect(ERROR_CODES.ALREADY_EXISTS).toBe("ALREADY_EXISTS");
    });

    it("should have all authentication and authorization error codes", () => {
      expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ERROR_CODES.FORBIDDEN).toBe("FORBIDDEN");
      expect(ERROR_CODES.INVALID_TOKEN).toBe("INVALID_TOKEN");
      expect(ERROR_CODES.TOKEN_EXPIRED).toBe("TOKEN_EXPIRED");
      expect(ERROR_CODES.SESSION_EXPIRED).toBe("SESSION_EXPIRED");
    });

    it("should have all database error codes", () => {
      expect(ERROR_CODES.DATABASE_ERROR).toBe("DATABASE_ERROR");
      expect(ERROR_CODES.QUERY_FAILED).toBe("QUERY_FAILED");
      expect(ERROR_CODES.CONNECTION_ERROR).toBe("CONNECTION_ERROR");
      expect(ERROR_CODES.DUPLICATE_ENTRY).toBe("DUPLICATE_ENTRY");
    });

    it("should have all payment and Stripe error codes", () => {
      expect(ERROR_CODES.STRIPE_ERROR).toBe("STRIPE_ERROR");
      expect(ERROR_CODES.PAYMENT_FAILED).toBe("PAYMENT_FAILED");
      expect(ERROR_CODES.PAYMENT_REQUIRED).toBe("PAYMENT_REQUIRED");
      expect(ERROR_CODES.SUBSCRIPTION_ERROR).toBe("SUBSCRIPTION_ERROR");
      expect(ERROR_CODES.INVOICE_ERROR).toBe("INVOICE_ERROR");
    });

    it("should have all email error codes", () => {
      expect(ERROR_CODES.EMAIL_ERROR).toBe("EMAIL_ERROR");
      expect(ERROR_CODES.EMAIL_SEND_FAILED).toBe("EMAIL_SEND_FAILED");
      expect(ERROR_CODES.INVALID_EMAIL).toBe("INVALID_EMAIL");
    });

    it("should have all network error codes", () => {
      expect(ERROR_CODES.NETWORK_ERROR).toBe("NETWORK_ERROR");
      expect(ERROR_CODES.TIMEOUT_ERROR).toBe("TIMEOUT_ERROR");
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe("SERVICE_UNAVAILABLE");
    });

    it("should have all rate limiting error codes", () => {
      expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMIT_EXCEEDED");
      expect(ERROR_CODES.TOO_MANY_REQUESTS).toBe("TOO_MANY_REQUESTS");
    });

    it("should have all file and upload error codes", () => {
      expect(ERROR_CODES.FILE_TOO_LARGE).toBe("FILE_TOO_LARGE");
      expect(ERROR_CODES.INVALID_FILE_TYPE).toBe("INVALID_FILE_TYPE");
      expect(ERROR_CODES.UPLOAD_FAILED).toBe("UPLOAD_FAILED");
    });

    it("should have all general error codes", () => {
      expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(ERROR_CODES.UNKNOWN_ERROR).toBe("UNKNOWN_ERROR");
      expect(ERROR_CODES.CONFIGURATION_ERROR).toBe("CONFIGURATION_ERROR");
    });
  });

  describe("AppError class", () => {
    it("should create an AppError with all properties", () => {
      const context = { userId: "123", action: "test" };
      const error = new AppError("Test error", ERROR_CODES.VALIDATION_ERROR, 400, context, true);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual(context);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
    });

    it("should use default values when not provided", () => {
      const error = new AppError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.context).toBeUndefined();
      expect(error.isOperational).toBe(true);
    });

    it("should capture stack trace", () => {
      const error = new AppError("Test error");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("AppError");
    });

    it("should inherit from Error correctly", () => {
      const error = new AppError("Test error");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it("should have correct name property", () => {
      const error = new AppError("Test error");
      expect(error.name).toBe("AppError");
    });

    it("should handle context with nested objects", () => {
      const context = {
        userId: "123",
        metadata: { foo: "bar", nested: { deep: true } },
      };
      const error = new AppError("Test", ERROR_CODES.INTERNAL_ERROR, 500, context);
      expect(error.context).toEqual(context);
    });

    it("should distinguish operational vs non-operational errors", () => {
      const operational = new AppError(
        "Operational",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        undefined,
        true
      );
      const nonOperational = new AppError(
        "Non-operational",
        ERROR_CODES.INTERNAL_ERROR,
        500,
        undefined,
        false
      );

      expect(operational.isOperational).toBe(true);
      expect(nonOperational.isOperational).toBe(false);
    });
  });

  describe("AppErrorFactory", () => {
    describe("validation", () => {
      it("should create validation error with correct properties", () => {
        const error = AppErrorFactory.validation("Invalid email format");

        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe("Invalid email format");
        expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
      });

      it("should create validation error with context", () => {
        const context = { field: "email", value: "invalid" };
        const error = AppErrorFactory.validation("Invalid email", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("notFound", () => {
      it("should create not found error", () => {
        const error = AppErrorFactory.notFound("User");

        expect(error.message).toBe("User not found");
        expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
        expect(error.statusCode).toBe(404);
      });

      it("should create not found error with context", () => {
        const context = { userId: "123" };
        const error = AppErrorFactory.notFound("Student", context);

        expect(error.message).toBe("Student not found");
        expect(error.context).toEqual(context);
      });
    });

    describe("unauthorized", () => {
      it("should create unauthorized error with default message", () => {
        const error = AppErrorFactory.unauthorized();

        expect(error.message).toBe("Unauthorized");
        expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
        expect(error.statusCode).toBe(401);
      });

      it("should create unauthorized error with custom message", () => {
        const error = AppErrorFactory.unauthorized("Invalid credentials");

        expect(error.message).toBe("Invalid credentials");
      });

      it("should create unauthorized error with context", () => {
        const context = { attemptedEmail: "user@example.com" };
        const error = AppErrorFactory.unauthorized("Invalid credentials", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("forbidden", () => {
      it("should create forbidden error with default message", () => {
        const error = AppErrorFactory.forbidden();

        expect(error.message).toBe("Forbidden");
        expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
        expect(error.statusCode).toBe(403);
      });

      it("should create forbidden error with custom message", () => {
        const error = AppErrorFactory.forbidden("Insufficient permissions");

        expect(error.message).toBe("Insufficient permissions");
      });

      it("should create forbidden error with context", () => {
        const context = { requiredRole: "admin", userRole: "user" };
        const error = AppErrorFactory.forbidden("Access denied", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("database", () => {
      it("should create database error", () => {
        const error = AppErrorFactory.database("Connection failed");

        expect(error.message).toBe("Connection failed");
        expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
        expect(error.statusCode).toBe(500);
      });

      it("should create database error with context", () => {
        const context = { query: "SELECT * FROM users", table: "users" };
        const error = AppErrorFactory.database("Query failed", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("stripe", () => {
      it("should create Stripe error", () => {
        const error = AppErrorFactory.stripe("Payment processing failed");

        expect(error.message).toBe("Payment processing failed");
        expect(error.code).toBe(ERROR_CODES.STRIPE_ERROR);
        expect(error.statusCode).toBe(500);
      });

      it("should create Stripe error with context", () => {
        const context = { customerId: "cus_123", amount: 5000 };
        const error = AppErrorFactory.stripe("Charge failed", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("email", () => {
      it("should create email error", () => {
        const error = AppErrorFactory.email("Failed to send email");

        expect(error.message).toBe("Failed to send email");
        expect(error.code).toBe(ERROR_CODES.EMAIL_ERROR);
        expect(error.statusCode).toBe(500);
      });

      it("should create email error with context", () => {
        const context = { to: "user@example.com", template: "welcome" };
        const error = AppErrorFactory.email("Send failed", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("network", () => {
      it("should create network error", () => {
        const error = AppErrorFactory.network("Request timeout");

        expect(error.message).toBe("Request timeout");
        expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
        expect(error.statusCode).toBe(503);
      });

      it("should create network error with context", () => {
        const context = { url: "https://api.example.com", timeout: 5000 };
        const error = AppErrorFactory.network("Timeout", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("rateLimit", () => {
      it("should create rate limit error with default message", () => {
        const error = AppErrorFactory.rateLimit();

        expect(error.message).toBe("Rate limit exceeded");
        expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
        expect(error.statusCode).toBe(429);
      });

      it("should create rate limit error with custom message", () => {
        const error = AppErrorFactory.rateLimit("Too many login attempts");

        expect(error.message).toBe("Too many login attempts");
      });

      it("should create rate limit error with context", () => {
        const context = { limit: 100, period: "1h" };
        const error = AppErrorFactory.rateLimit("Limit exceeded", context);

        expect(error.context).toEqual(context);
      });
    });

    describe("internal", () => {
      it("should create internal error with default message", () => {
        const error = AppErrorFactory.internal();

        expect(error.message).toBe("Internal server error");
        expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(false);
      });

      it("should create internal error with custom message", () => {
        const error = AppErrorFactory.internal("Unexpected error occurred");

        expect(error.message).toBe("Unexpected error occurred");
      });

      it("should create internal error with context", () => {
        const context = { originalError: "Some internal issue" };
        const error = AppErrorFactory.internal("Server error", context);

        expect(error.context).toEqual(context);
      });

      it("should mark internal errors as non-operational", () => {
        const error = AppErrorFactory.internal();
        expect(error.isOperational).toBe(false);
      });
    });
  });

  describe("isAppError type guard", () => {
    it("should return true for AppError instances", () => {
      const error = new AppError("Test error");
      expect(isAppError(error)).toBe(true);
    });

    it("should return true for AppErrorFactory created errors", () => {
      const error = AppErrorFactory.validation("Invalid");
      expect(isAppError(error)).toBe(true);
    });

    it("should return false for standard Error", () => {
      const error = new Error("Regular error");
      expect(isAppError(error)).toBe(false);
    });

    it("should return false for string", () => {
      expect(isAppError("error string")).toBe(false);
    });

    it("should return false for object", () => {
      expect(isAppError({ message: "error" })).toBe(false);
    });

    it("should return false for null", () => {
      expect(isAppError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isAppError(undefined)).toBe(false);
    });

    it("should return false for numbers", () => {
      expect(isAppError(123)).toBe(false);
    });
  });

  describe("Logger functionality", () => {
    let originalLogger: ReturnType<typeof getLogger>;
    let mockLogger: {
      info: (message: string, context?: ErrorContext) => void;
      warn: (message: string, context?: ErrorContext) => void;
      error: (message: string, context?: ErrorContext) => void;
      debug: (message: string, context?: ErrorContext) => void;
    };

    beforeEach(() => {
      originalLogger = getLogger();
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
    });

    afterEach(() => {
      setLogger(originalLogger);
    });

    describe("ConsoleLogger", () => {
      let consoleLogSpy: ReturnType<typeof vi.spyOn>;
      let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
      let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      });

      afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it("should use console logger by default", () => {
        const logger = getLogger();
        logger.info("test");

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
      });

      it("should format console log messages with timestamp and level", () => {
        const logger = getLogger();
        logger.info("test message", { key: "value" });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[INFO\].*timestamp.*level.*info.*test message.*key.*value/)
        );
      });

      it("should format console warn messages", () => {
        const logger = getLogger();
        logger.warn("warning message", { severity: "high" });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[WARN\].*timestamp.*level.*warn.*warning message/)
        );
      });

      it("should format console error messages", () => {
        const logger = getLogger();
        logger.error("error message", { critical: true });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[ERROR\].*timestamp.*level.*error.*error message/)
        );
      });

      it("should format console debug messages", () => {
        const logger = getLogger();
        logger.debug("debug message", { data: 123 });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[DEBUG\].*timestamp.*level.*debug.*debug message/)
        );
      });

      it("should include context in formatted messages", () => {
        const logger = getLogger();
        logger.info("message", { userId: "123", action: "test" });

        const callArg = consoleLogSpy.mock.calls[0][0];
        expect(callArg).toContain("userId");
        expect(callArg).toContain("123");
        expect(callArg).toContain("action");
        expect(callArg).toContain("test");
      });
    });

    it("should allow setting a custom logger", () => {
      setLogger(mockLogger);
      const logger = getLogger();
      expect(logger).toBe(mockLogger);
    });

    it("should use custom logger for logging", () => {
      setLogger(mockLogger);
      const logger = getLogger();

      logger.info("test message", { context: "test" });
      logger.warn("warning", { level: "high" });
      logger.error("error", { critical: true });
      logger.debug("debug info", { data: 123 });

      expect(mockLogger.info).toHaveBeenCalledWith("test message", { context: "test" });
      expect(mockLogger.warn).toHaveBeenCalledWith("warning", { level: "high" });
      expect(mockLogger.error).toHaveBeenCalledWith("error", { critical: true });
      expect(mockLogger.debug).toHaveBeenCalledWith("debug info", { data: 123 });
    });

    it("should persist logger across multiple getLogger calls", () => {
      setLogger(mockLogger);
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
      expect(logger1).toBe(mockLogger);
    });

    it("should use console logger as default", () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });

  describe("handleError function", () => {
    let mockLogger: {
      info: (message: string, context?: ErrorContext) => void;
      warn: (message: string, context?: ErrorContext) => void;
      error: (message: string, context?: ErrorContext) => void;
      debug: (message: string, context?: ErrorContext) => void;
    };
    let originalLogger: ReturnType<typeof getLogger>;

    beforeEach(() => {
      originalLogger = getLogger();
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setLogger(mockLogger);
    });

    afterEach(() => {
      setLogger(originalLogger);
    });

    it("should log AppError with error level by default", () => {
      const error = AppErrorFactory.validation("Invalid input");
      handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid input",
        expect.objectContaining({
          code: ERROR_CODES.VALIDATION_ERROR,
          statusCode: 400,
        })
      );
    });

    it("should log standard Error", () => {
      const error = new Error("Standard error");
      handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Standard error",
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it("should log string errors", () => {
      handleError("Something went wrong");

      expect(mockLogger.error).toHaveBeenCalledWith("Something went wrong", expect.any(Object));
    });

    it("should log object with message", () => {
      handleError({ message: "Object error", extra: "data" });

      expect(mockLogger.error).toHaveBeenCalledWith("Object error", expect.any(Object));
    });

    it("should handle unknown error types", () => {
      handleError(123);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "An unknown error occurred",
        expect.objectContaining({ error: "123" })
      );
    });

    it("should merge context from error and options", () => {
      const error = new AppError("Test", ERROR_CODES.INTERNAL_ERROR, 500, {
        errorContext: "value1",
      });
      handleError(error, { context: { optionContext: "value2" } });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Test",
        expect.objectContaining({
          errorContext: "value1",
          optionContext: "value2",
        })
      );
    });

    it("should respect logLevel option: info", () => {
      const error = new Error("Info level error");
      handleError(error, { logLevel: "info" });

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should respect logLevel option: warn", () => {
      const error = new Error("Warning level error");
      handleError(error, { logLevel: "warn" });

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should respect logLevel option: debug", () => {
      const error = new Error("Debug level error");
      handleError(error, { logLevel: "debug" });

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should show notification when requested", () => {
      const error = new Error("User-facing error");
      handleError(error, { showNotification: true });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("[NOTIFICATION]"),
        expect.objectContaining({ notification: true })
      );
    });

    it("should use custom notification message", () => {
      const error = new Error("Technical error");
      handleError(error, {
        showNotification: true,
        notificationMessage: "User-friendly message",
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("User-friendly message"),
        expect.objectContaining({ notification: true })
      );
    });

    it("should rethrow error when requested", () => {
      const error = new Error("Rethrow me");

      expect(() => {
        handleError(error, { rethrow: true });
      }).toThrow("Rethrow me");

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should not rethrow by default", () => {
      const error = new Error("Do not rethrow");

      expect(() => {
        handleError(error);
      }).not.toThrow();
    });

    it("should include stack trace in context", () => {
      const error = new Error("Error with stack");
      handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error with stack",
        expect.objectContaining({
          stack: expect.stringContaining("Error"),
        })
      );
    });

    it("should handle null error", () => {
      handleError(null);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "An unknown error occurred",
        expect.any(Object)
      );
    });

    it("should handle undefined error", () => {
      handleError(undefined);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "An unknown error occurred",
        expect.any(Object)
      );
    });
  });

  describe("withErrorHandling wrapper", () => {
    let mockLogger: {
      info: (message: string, context?: ErrorContext) => void;
      warn: (message: string, context?: ErrorContext) => void;
      error: (message: string, context?: ErrorContext) => void;
      debug: (message: string, context?: ErrorContext) => void;
    };
    let originalLogger: ReturnType<typeof getLogger>;

    beforeEach(() => {
      originalLogger = getLogger();
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setLogger(mockLogger);
    });

    afterEach(() => {
      setLogger(originalLogger);
    });

    it("should return function result on success", async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(5);
      expect(result).toBe(10);
    });

    it("should handle errors and return null", async () => {
      const fn = async () => {
        throw new Error("Test error");
      };
      const wrapped = withErrorHandling(fn);

      const result = await wrapped();
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should pass through function arguments", async () => {
      const fn = async (a: number, b: string, c: boolean) => ({ a, b, c });
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(1, "test", true);
      expect(result).toEqual({ a: 1, b: "test", c: true });
    });

    it("should apply error handling options", async () => {
      const fn = async () => {
        throw new Error("Test error");
      };
      const wrapped = withErrorHandling(fn, {
        context: { operation: "test" },
        logLevel: "warn",
      });

      await wrapped();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Test error",
        expect.objectContaining({ operation: "test" })
      );
    });

    it("should handle AppError instances", async () => {
      const fn = async () => {
        throw AppErrorFactory.validation("Invalid data");
      };
      const wrapped = withErrorHandling(fn);

      const result = await wrapped();
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid data",
        expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR })
      );
    });

    it("should handle multiple arguments correctly", async () => {
      const fn = async (x: number, y: number, z: number) => x + y + z;
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(1, 2, 3);
      expect(result).toBe(6);
    });

    it("should handle promise rejections", async () => {
      const fn = async () => Promise.reject(new Error("Rejected"));
      const wrapped = withErrorHandling(fn);

      const result = await wrapped();
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should return complex objects", async () => {
      const fn = async () => ({
        user: { id: 1, name: "Test" },
        meta: { timestamp: Date.now() },
      });
      const wrapped = withErrorHandling(fn);

      const result = await wrapped();
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("meta");
    });

    it("should handle void functions", async () => {
      let sideEffect = false;
      const fn = async () => {
        sideEffect = true;
      };
      const wrapped = withErrorHandling(fn);

      await wrapped();
      expect(sideEffect).toBe(true);
    });
  });

  describe("withErrorResult wrapper", () => {
    it("should return success result on successful execution", async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorResult(fn);

      const result = await wrapped(5);
      expect(result).toEqual({ success: true, data: 10 });
    });

    it("should return error result on failure", async () => {
      const fn = async () => {
        throw new Error("Test error");
      };
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      expect(result).toEqual({
        success: false,
        error: "Test error",
      });
    });

    it("should include error code for AppError", async () => {
      const fn = async () => {
        throw AppErrorFactory.validation("Invalid input");
      };
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      expect(result).toEqual({
        success: false,
        error: "Invalid input",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    });

    it("should handle string errors", async () => {
      const fn = async () => {
        throw "String error";
      };
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      expect(result).toEqual({
        success: false,
        error: "String error",
      });
    });

    it("should handle unknown error types", async () => {
      const fn = async () => {
        throw 123;
      };
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      expect(result).toEqual({
        success: false,
        error: "An unknown error occurred",
      });
    });

    it("should handle complex return types", async () => {
      const fn = async () => ({
        user: { id: 1, name: "Test" },
        settings: { theme: "dark" },
      });
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      if (result.success) {
        expect(result.data).toHaveProperty("user");
        expect(result.data).toHaveProperty("settings");
      }
    });

    it("should pass through function arguments", async () => {
      const fn = async (a: number, b: string) => `${b}-${a}`;
      const wrapped = withErrorResult(fn);

      const result = await wrapped(123, "test");
      expect(result).toEqual({
        success: true,
        data: "test-123",
      });
    });

    it("should handle promise rejections", async () => {
      const fn = async () => Promise.reject(new Error("Rejected"));
      const wrapped = withErrorResult(fn);

      const result = await wrapped();
      expect(result).toEqual({
        success: false,
        error: "Rejected",
      });
    });

    it("should work with type guards", async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorResult(fn);

      const result = await wrapped(5);
      if (result.success) {
        expect(result.data).toBe(10);
        // TypeScript should know data exists here
      } else {
        expect(result.error).toBeDefined();
        // TypeScript should know error exists here
      }
    });
  });

  describe("asyncErrorBoundary", () => {
    let mockLogger: {
      info: (message: string, context?: ErrorContext) => void;
      warn: (message: string, context?: ErrorContext) => void;
      error: (message: string, context?: ErrorContext) => void;
      debug: (message: string, context?: ErrorContext) => void;
    };
    let originalLogger: ReturnType<typeof getLogger>;

    beforeEach(() => {
      originalLogger = getLogger();
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setLogger(mockLogger);
    });

    afterEach(() => {
      setLogger(originalLogger);
    });

    it("should return function result on success", async () => {
      const fn = async () => ({ users: [1, 2, 3] });
      const result = await asyncErrorBoundary(fn, { users: [] });

      expect(result).toEqual({ users: [1, 2, 3] });
    });

    it("should return fallback on error", async () => {
      const fn = async () => {
        throw new Error("Failed to fetch");
      };
      const fallback = { users: [] };
      const result = await asyncErrorBoundary(fn, fallback);

      expect(result).toEqual(fallback);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle error with context", async () => {
      const fn = async () => {
        throw new Error("Error");
      };
      await asyncErrorBoundary(fn, null, { context: { page: "users" } });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ page: "users" })
      );
    });

    it("should handle complex fallback values", async () => {
      const fn = async () => {
        throw new Error("Failed");
      };
      const fallback = {
        data: [],
        meta: { total: 0, page: 1 },
      };
      const result = await asyncErrorBoundary(fn, fallback);

      expect(result).toEqual(fallback);
    });

    it("should preserve successful data types", async () => {
      const fn = async () => "string result";
      const result = await asyncErrorBoundary(fn, "fallback");

      expect(result).toBe("string result");
    });

    it("should handle AppError instances", async () => {
      const fn = async () => {
        throw AppErrorFactory.database("Connection failed");
      };
      const result = await asyncErrorBoundary(fn, null);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Connection failed",
        expect.objectContaining({ code: ERROR_CODES.DATABASE_ERROR })
      );
    });

    it("should work with different fallback types", async () => {
      const stringFn = async () => {
        throw new Error("Failed");
      };
      const stringResult = await asyncErrorBoundary(stringFn, "fallback");
      expect(stringResult).toBe("fallback");

      const numberFn = async () => {
        throw new Error("Failed");
      };
      const numberResult = await asyncErrorBoundary(numberFn, 0);
      expect(numberResult).toBe(0);

      const boolFn = async () => {
        throw new Error("Failed");
      };
      const boolResult = await asyncErrorBoundary(boolFn, false);
      expect(boolResult).toBe(false);
    });
  });

  describe("ErrorUtils", () => {
    describe("isErrorCode", () => {
      it("should return true for matching error code", () => {
        const error = AppErrorFactory.validation("Invalid");
        expect(ErrorUtils.isErrorCode(error, ERROR_CODES.VALIDATION_ERROR)).toBe(true);
      });

      it("should return false for non-matching error code", () => {
        const error = AppErrorFactory.validation("Invalid");
        expect(ErrorUtils.isErrorCode(error, ERROR_CODES.NOT_FOUND)).toBe(false);
      });

      it("should return false for standard Error", () => {
        const error = new Error("Standard");
        expect(ErrorUtils.isErrorCode(error, ERROR_CODES.VALIDATION_ERROR)).toBe(false);
      });

      it("should return false for non-error values", () => {
        expect(ErrorUtils.isErrorCode("string", ERROR_CODES.VALIDATION_ERROR)).toBe(false);
        expect(ErrorUtils.isErrorCode(null, ERROR_CODES.VALIDATION_ERROR)).toBe(false);
        expect(ErrorUtils.isErrorCode(undefined, ERROR_CODES.VALIDATION_ERROR)).toBe(false);
      });

      it("should work with all error codes", () => {
        const error = AppErrorFactory.notFound("User");
        expect(ErrorUtils.isErrorCode(error, ERROR_CODES.NOT_FOUND)).toBe(true);

        const error2 = AppErrorFactory.unauthorized();
        expect(ErrorUtils.isErrorCode(error2, ERROR_CODES.UNAUTHORIZED)).toBe(true);

        const error3 = AppErrorFactory.database("Failed");
        expect(ErrorUtils.isErrorCode(error3, ERROR_CODES.DATABASE_ERROR)).toBe(true);
      });
    });

    describe("getUserMessage", () => {
      it("should return user-friendly message for validation errors", () => {
        const error = AppErrorFactory.validation("Field is required");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Please check your input and try again.");
      });

      it("should return user-friendly message for not found errors", () => {
        const error = AppErrorFactory.notFound("User");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("The requested resource was not found.");
      });

      it("should return user-friendly message for unauthorized errors", () => {
        const error = AppErrorFactory.unauthorized();
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Please sign in to continue.");
      });

      it("should return user-friendly message for forbidden errors", () => {
        const error = AppErrorFactory.forbidden();
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("You do not have permission to perform this action.");
      });

      it("should return user-friendly message for database errors", () => {
        const error = AppErrorFactory.database("Query failed");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("A database error occurred. Please try again later.");
      });

      it("should return user-friendly message for Stripe errors", () => {
        const error = AppErrorFactory.stripe("Charge failed");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("A payment error occurred. Please try again.");
      });

      it("should return user-friendly message for email errors", () => {
        const error = AppErrorFactory.email("Send failed");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Failed to send email. Please try again.");
      });

      it("should return user-friendly message for network errors", () => {
        const error = AppErrorFactory.network("Timeout");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Network error. Please check your connection.");
      });

      it("should return user-friendly message for rate limit errors", () => {
        const error = AppErrorFactory.rateLimit();
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Too many requests. Please try again later.");
      });

      it("should return original message for unmapped error codes", () => {
        const error = new AppError("Custom error", ERROR_CODES.INTERNAL_ERROR);
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Custom error");
      });

      it("should handle standard Error instances", () => {
        const error = new Error("Something went wrong");
        const message = ErrorUtils.getUserMessage(error);
        expect(message).toBe("Something went wrong");
      });

      it("should handle string errors", () => {
        const message = ErrorUtils.getUserMessage("String error");
        expect(message).toBe("String error");
      });

      it("should handle unknown error types", () => {
        const message = ErrorUtils.getUserMessage(null);
        expect(message).toBe("An unknown error occurred");
      });
    });

    describe("isRetryable", () => {
      it("should return true for network errors", () => {
        const error = AppErrorFactory.network("Connection failed");
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it("should return true for timeout errors", () => {
        const error = new AppError("Timeout", ERROR_CODES.TIMEOUT_ERROR);
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it("should return true for service unavailable errors", () => {
        const error = new AppError("Service down", ERROR_CODES.SERVICE_UNAVAILABLE);
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it("should return true for database errors", () => {
        const error = AppErrorFactory.database("Connection lost");
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it("should return false for validation errors", () => {
        const error = AppErrorFactory.validation("Invalid input");
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should return false for not found errors", () => {
        const error = AppErrorFactory.notFound("User");
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should return false for unauthorized errors", () => {
        const error = AppErrorFactory.unauthorized();
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should return false for forbidden errors", () => {
        const error = AppErrorFactory.forbidden();
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should return false for standard Error", () => {
        const error = new Error("Standard error");
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should return false for non-AppError values", () => {
        expect(ErrorUtils.isRetryable("string")).toBe(false);
        expect(ErrorUtils.isRetryable(null)).toBe(false);
        expect(ErrorUtils.isRetryable(undefined)).toBe(false);
      });

      it("should handle rate limit errors (not retryable)", () => {
        const error = AppErrorFactory.rateLimit();
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it("should handle Stripe errors (not retryable)", () => {
        const error = AppErrorFactory.stripe("Payment failed");
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });
    });
  });

  describe("Integration scenarios", () => {
    let mockLogger: {
      info: (message: string, context?: ErrorContext) => void;
      warn: (message: string, context?: ErrorContext) => void;
      error: (message: string, context?: ErrorContext) => void;
      debug: (message: string, context?: ErrorContext) => void;
    };
    let originalLogger: ReturnType<typeof getLogger>;

    beforeEach(() => {
      originalLogger = getLogger();
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setLogger(mockLogger);
    });

    afterEach(() => {
      setLogger(originalLogger);
    });

    it("should handle API error flow: validate -> throw -> catch -> handle", async () => {
      const createUser = async (email: string) => {
        if (!email.includes("@")) {
          throw AppErrorFactory.validation("Invalid email format", { email });
        }
        return { id: 1, email };
      };

      const wrapped = withErrorHandling(createUser, {
        showNotification: true,
        context: { operation: "user_creation" },
      });

      const result = await wrapped("invalid-email");
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid email format",
        expect.objectContaining({
          code: ERROR_CODES.VALIDATION_ERROR,
          operation: "user_creation",
          email: "invalid-email",
        })
      );
    });

    it("should handle database error with retry logic", async () => {
      const dbOperation = async () => {
        throw AppErrorFactory.database("Connection lost", { attempt: 1 });
      };

      const result = await withErrorResult(dbOperation)();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR);
        expect(ErrorUtils.isRetryable(new AppError(result.error, result.code))).toBe(true);
      }
    });

    it("should handle authentication flow", async () => {
      const authenticate = async (token: string) => {
        if (!token) {
          throw AppErrorFactory.unauthorized("Missing token", { token });
        }
        return { user: { id: 1 } };
      };

      try {
        await authenticate("");
      } catch (error) {
        expect(isAppError(error)).toBe(true);
        if (isAppError(error)) {
          expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
          expect(error.statusCode).toBe(401);
          expect(ErrorUtils.getUserMessage(error)).toBe("Please sign in to continue.");
        }
      }
    });

    it("should handle payment processing with Stripe", async () => {
      const processPayment = async (amount: number) => {
        if (amount <= 0) {
          throw AppErrorFactory.validation("Invalid amount");
        }
        // Simulate Stripe error
        throw AppErrorFactory.stripe("Card declined", {
          amount,
          reason: "insufficient_funds",
        });
      };

      const result = await withErrorResult(processPayment)(100);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe(ERROR_CODES.STRIPE_ERROR);
        expect(ErrorUtils.getUserMessage(new AppError(result.error, result.code))).toBe(
          "A payment error occurred. Please try again."
        );
      }
    });

    it("should handle server component data fetching", async () => {
      const fetchPageData = async () => {
        throw new Error("Failed to fetch");
      };

      const data = await asyncErrorBoundary(
        fetchPageData,
        { users: [], defaultView: true },
        { context: { page: "dashboard" } }
      );

      expect(data).toEqual({ users: [], defaultView: true });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle email sending with proper error messages", async () => {
      const sendWelcomeEmail = async (email: string) => {
        throw AppErrorFactory.email("SMTP connection failed", {
          to: email,
          template: "welcome",
        });
      };

      const wrapped = withErrorResult(sendWelcomeEmail);
      const result = await wrapped("user@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(ErrorUtils.getUserMessage(new AppError(result.error, result.code))).toBe(
          "Failed to send email. Please try again."
        );
      }
    });

    it("should handle rate limiting scenario", async () => {
      const apiCall = async () => {
        throw AppErrorFactory.rateLimit("Too many login attempts", {
          limit: 5,
          window: "15m",
        });
      };

      try {
        await apiCall();
      } catch (error) {
        expect(ErrorUtils.isErrorCode(error, ERROR_CODES.RATE_LIMIT_EXCEEDED)).toBe(true);
        if (isAppError(error)) {
          expect(error.statusCode).toBe(429);
          expect(ErrorUtils.isRetryable(error)).toBe(false);
        }
      }
    });

    it("should handle not found with proper context", async () => {
      const getStudent = async (id: string) => {
        throw AppErrorFactory.notFound("Student", { studentId: id });
      };

      const result = await withErrorResult(getStudent)("123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Student not found");
        expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
      }
    });

    it("should differentiate operational vs programming errors", async () => {
      // Operational error (expected, should handle gracefully)
      const operational = AppErrorFactory.validation("Invalid input");
      expect(operational.isOperational).toBe(true);

      // Programming error (unexpected, should alert developers)
      const programming = AppErrorFactory.internal("Null reference");
      expect(programming.isOperational).toBe(false);
    });

    it("should handle complex error context merging", async () => {
      const error = new AppError("Complex error", ERROR_CODES.INTERNAL_ERROR, 500, {
        originalContext: "value1",
        nested: { deep: true },
      });

      handleError(error, {
        context: {
          requestId: "req-123",
          userId: "user-456",
          nested: { shallow: false },
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Complex error",
        expect.objectContaining({
          originalContext: "value1",
          requestId: "req-123",
          userId: "user-456",
          // Note: nested objects may be overwritten, not deep merged
        })
      );
    });

    it("should create error chains for debugging", async () => {
      const level1 = async () => {
        throw new Error("Database query failed");
      };

      const level2 = async () => {
        try {
          await level1();
        } catch (error) {
          throw AppErrorFactory.database("Failed to fetch user", {
            originalError: error instanceof Error ? error.message : String(error),
          });
        }
      };

      const result = await withErrorResult(level2)();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR);
        expect(result.error).toBe("Failed to fetch user");
      }
    });

    it("should handle multiple error handlers in sequence", async () => {
      const riskyOperation = async () => {
        throw new Error("Something failed");
      };

      // First layer: withErrorHandling
      const withHandling = withErrorHandling(riskyOperation, {
        context: { layer: "handling" },
      });

      // Second layer: withErrorResult
      const withResult = withErrorResult(async () => {
        const result = await withHandling();
        if (result === null) {
          throw new Error("Handling returned null");
        }
        return result;
      });

      const finalResult = await withResult();
      expect(finalResult.success).toBe(false);
    });
  });
});
