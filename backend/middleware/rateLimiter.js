/**
 * Rate Limiting Middleware
 *
 * Protects the API from brute force attacks and DOS
 */

const rateLimit = require("express-rate-limit");

const isNonProduction = process.env.NODE_ENV !== "production";

const parseEnvInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// General API rate limiter - 100 requests per hour per IP
const apiLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parseEnvInt(process.env.API_RATE_LIMIT_MAX, 100),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: () => isNonProduction,
});

// Strict limiter for login - 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: parseEnvInt(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  ),
  max: parseEnvInt(process.env.LOGIN_RATE_LIMIT_MAX, 5),
  message: "Too many login attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false, // Count failed requests
  key: (req, res) => req.body?.email || req.ip, // Rate limit by email orIP
  skip: () => isNonProduction,
});

// Rate limiter for password reset - 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: parseEnvInt(
    process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    60 * 60 * 1000,
  ),
  max: parseEnvInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, 3),
  message: "Too many password reset requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  key: (req, res) => req.body?.email || req.ip,
  skip: () => isNonProduction,
});

// Rate limiter for file uploads - 10 uploads per hour per user
const uploadLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: parseEnvInt(process.env.UPLOAD_RATE_LIMIT_MAX, 10),
  message: "Too many file uploads, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  key: (req, res) => req.user?.id || req.ip, // Use user ID if authenticated
  skip: (req) => isNonProduction || !req.user,
});

// Rate limiter for complaint submission - 5 per hour per user
const complaintSubmitLimiter = rateLimit({
  windowMs: parseEnvInt(
    process.env.COMPLAINT_RATE_LIMIT_WINDOW_MS,
    60 * 60 * 1000,
  ),
  max: parseEnvInt(process.env.COMPLAINT_RATE_LIMIT_MAX, 5),
  message: "Too many complaints submitted, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  key: (req, res) => req.user?.id || req.ip,
  skip: (req) => isNonProduction || !req.user,
});

// Rate limiter for API endpoints - 30 requests per minute for authenticated users
const apiAuthenticatedLimiter = rateLimit({
  windowMs: parseEnvInt(
    process.env.AUTH_API_RATE_LIMIT_WINDOW_MS,
    60 * 1000,
  ),
  max: parseEnvInt(process.env.AUTH_API_RATE_LIMIT_MAX, 30),
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  key: (req, res) => req.user?.id || req.ip,
  skip: (req) => isNonProduction || !req.user,
});

// Rate limiter for public endpoints - 20 requests per minute per IP
const publicApiLimiter = rateLimit({
  windowMs: parseEnvInt(
    process.env.PUBLIC_API_RATE_LIMIT_WINDOW_MS,
    60 * 1000,
  ),
  max: parseEnvInt(process.env.PUBLIC_API_RATE_LIMIT_MAX, 20),
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isNonProduction || req.user,
});

module.exports = {
  apiLimiter,
  loginLimiter,
  passwordResetLimiter,
  uploadLimiter,
  complaintSubmitLimiter,
  apiAuthenticatedLimiter,
  publicApiLimiter,
};
