/**
 * Error Handler Middleware
 *
 * Centralized error handling for the application:
 * - Custom error classes
 * - Error formatting
 * - Error logging
 * - Production vs development error responses
 */

const logger = require("../utils/logger");
const { captureException } = require("../config/sentry");

/**
 * Custom API Error class
 * Extends Error to include status code and operational flag
 */
class ApiError extends Error {
  constructor(message, statusCode, code = null, errors = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // Distinguishes from programming errors

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message, code = "BAD_REQUEST", errors = null) {
    return new ApiError(message, 400, code, errors);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message = "Unauthorized access", code = "UNAUTHORIZED") {
    return new ApiError(message, 401, code);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message = "Access forbidden", code = "FORBIDDEN") {
    return new ApiError(message, 403, code);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new ApiError(message, 404, code);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(message, code = "CONFLICT") {
    return new ApiError(message, 409, code);
  }

  /**
   * Create a 422 Unprocessable Entity error
   */
  static unprocessable(message, code = "UNPROCESSABLE", errors = null) {
    return new ApiError(message, 422, code, errors);
  }

  /**
   * Create a 429 Too Many Requests error
   */
  static tooManyRequests(message = "Too many requests", code = "RATE_LIMIT") {
    return new ApiError(message, 429, code);
  }

  /**
   * Create a 500 Internal Server Error
   */
  static internal(message = "Internal server error", code = "INTERNAL_ERROR") {
    return new ApiError(message, 500, code);
  }
}

/**
 * Validation Error class
 * For handling validation errors with field-specific messages
 */
class ValidationError extends ApiError {
  constructor(errors) {
    const message = "Validation failed";
    super(message, 400, "VALIDATION_ERROR", errors);
    this.name = "ValidationError";
  }

  /**
   * Create from express-validator errors
   */
  static fromExpressValidator(errors) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return new ValidationError(formattedErrors);
  }

  /**
   * Create from Mongoose validation errors
   */
  static fromMongoose(error) {
    const formattedErrors = Object.keys(error.errors).map((key) => ({
      field: key,
      message: error.errors[key].message,
      value: error.errors[key].value,
    }));

    return new ValidationError(formattedErrors);
  }
}

/**
 * Handle specific error types
 */

// Handle MongoDB CastError (invalid ObjectId)
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ApiError(message, 400, "INVALID_ID");
};

// Handle MongoDB duplicate key error
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate value for field '${field}': ${value}. Please use a different value.`;
  return new ApiError(message, 409, "DUPLICATE_KEY", [{ field, value }]);
};

// Handle Mongoose validation error
const handleValidationError = (err) => {
  return ValidationError.fromMongoose(err);
};

// Handle JWT errors
const handleJWTError = () => {
  return new ApiError(
    "Invalid token. Please login again.",
    401,
    "INVALID_TOKEN",
  );
};

const handleJWTExpiredError = () => {
  return new ApiError(
    "Your token has expired. Please login again.",
    401,
    "TOKEN_EXPIRED",
  );
};

// Handle multer errors
const handleMulterError = (err) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return new ApiError(
      "File size exceeds the maximum allowed limit.",
      400,
      "FILE_TOO_LARGE",
    );
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return new ApiError("Too many files uploaded.", 400, "TOO_MANY_FILES");
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return new ApiError("Unexpected file field.", 400, "UNEXPECTED_FILE");
  }
  return new ApiError("File upload error.", 400, "UPLOAD_ERROR");
};

// Handle invalid JSON payload errors from express.json()
const handleBodyParserError = (err) => {
  if (err.type === "entity.parse.failed") {
    return new ApiError("Malformed JSON payload", 400, "INVALID_JSON");
  }
  return err;
};

// Handle CSRF token errors
const handleCsrfError = (err) => {
  if (err.code === "EBADCSRFTOKEN") {
    return new ApiError(
      "Invalid or missing CSRF token",
      403,
      "CSRF_TOKEN_INVALID",
    );
  }
  return err;
};

/**
 * Format error for development environment
 * Includes full error details and stack trace
 */
const sendErrorDev = (err, req, res) => {
  logger.error("Unhandled error (dev)", {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  if ((err.statusCode || 500) >= 500) {
    captureException(err, {
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
    });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    status: err.status || "error",
    message: err.message,
    code: err.code,
    errors: err.errors,
    error: err,
    stack: err.stack,
  });
};

/**
 * Format error for production environment
 * Hides implementation details for security
 */
const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      code: err.code,
      errors: err.errors,
    });
  }

  // Programming or unknown error: don't leak error details
  logger.error("Unhandled error (prod)", {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  captureException(err, {
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  });

  return res.status(500).json({
    success: false,
    status: "error",
    message: "Something went wrong. Please try again later.",
    code: "INTERNAL_ERROR",
  });
};

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
  // Set default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  }

  // Development environment
  if (process.env.NODE_ENV === "development") {
    return sendErrorDev(err, req, res);
  }

  // Production environment
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;

  // Handle specific error types
  if (err.name === "CastError") {
    error = handleCastError(err);
  }

  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  if (err.name === "ValidationError" && err.errors) {
    error = handleValidationError(err);
  }

  if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  }

  if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  }

  if (err.name === "MulterError") {
    error = handleMulterError(err);
  }

  if (err.type === "entity.parse.failed") {
    error = handleBodyParserError(err);
  }

  if (err.code === "EBADCSRFTOKEN") {
    error = handleCsrfError(err);
  }

  return sendErrorProd(error, req, res);
};

/**
 * Async handler wrapper
 * Catches errors in async route handlers and passes them to error handler
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json({ users });
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 * Handles requests to undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(
    `Cannot ${req.method} ${req.originalUrl}`,
    "ROUTE_NOT_FOUND",
  );
  next(error);
};

/**
 * Request logging for errors
 * Logs request details when an error occurs
 */
const errorLogger = (err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get("User-Agent"),
    error: {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
    body: req.method !== "GET" ? sanitizeBody(req.body) : undefined,
  };

  logger.error("Error log", errorLog);

  next(err);
};

/**
 * Sanitize request body for logging
 * Removes sensitive fields
 */
const sanitizeBody = (body) => {
  if (!body) return undefined;

  const sanitized = { ...body };
  const sensitiveFields = [
    "password",
    "confirmPassword",
    "currentPassword",
    "newPassword",
    "token",
    "refreshToken",
  ];

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  });

  return sanitized;
};

/**
 * Unhandled rejection handler
 * Handles promise rejections that aren't caught
 */
const setupUnhandledRejectionHandler = (server) => {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);

    // Give server time to handle existing requests before shutting down
    server.close(() => {
      console.log("Server closed due to unhandled rejection");
      process.exit(1);
    });
  });
};

/**
 * Uncaught exception handler
 * Handles synchronous errors that aren't caught
 */
const setupUncaughtExceptionHandler = () => {
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);

    // Must exit process for uncaught exceptions
    process.exit(1);
  });
};

/**
 * SIGTERM handler
 * Graceful shutdown on SIGTERM signal
 */
const setupSIGTERMHandler = (server) => {
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");

    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
};

/**
 * Create standardized error response
 * Utility function for controllers
 *
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Array} errors - Detailed errors array
 */
const sendError = (res, statusCode, message, code = null, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (code) response.code = code;
  if (errors) response.errors = errors;

  return res.status(statusCode).json(response);
};

/**
 * Create standardized success response
 * Utility function for controllers
 *
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object} data - Response data
 */
const sendSuccess = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) response.data = data;

  return res.status(statusCode).json(response);
};

module.exports = {
  // Error classes
  ApiError,
  ValidationError,

  // Middleware
  errorHandler,
  errorLogger,
  notFoundHandler,
  asyncHandler,

  // Process handlers
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
  setupSIGTERMHandler,

  // Utility functions
  sendError,
  sendSuccess,
};
