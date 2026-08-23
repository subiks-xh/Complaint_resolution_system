/**
 * Token Generation Utility
 *
 * Provides helper functions for JWT token generation and management:
 * - Access token generation
 * - Refresh token generation
 * - Token pair generation
 * - Token cookie setting
 * - Token utilities
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * JWT Configuration
 */
const config = {
  accessToken: {
    secret:
      process.env.JWT_ACCESS_SECRET ||
      "your-super-secret-access-key-change-in-production",
    expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
  },
  refreshToken: {
    secret:
      process.env.JWT_REFRESH_SECRET ||
      "your-super-secret-refresh-key-change-in-production",
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  },
  issuer: process.env.JWT_ISSUER || "complaint-resolution-system",
  audience: process.env.JWT_AUDIENCE || "complaint-resolution-users",
};

/**
 * Generate Access Token
 *
 * Creates a short-lived JWT for API authentication
 *
 * @param {Object} user - User object
 * @param {string} user._id - User ID
 * @param {string} user.email - User email
 * @param {string} user.role - User role
 * @param {Object} options - Additional options
 * @returns {string} Signed JWT access token
 */
const generateAccessToken = (user, options = {}) => {
  if (!user || !user._id) {
    throw new Error("User object with _id is required");
  }

  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    type: "access",
    ...options.additionalPayload,
  };

  const signOptions = {
    expiresIn: options.expiresIn || config.accessToken.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
    algorithm: "HS256",
  };

  return jwt.sign(payload, config.accessToken.secret, signOptions);
};

/**
 * Generate Refresh Token
 *
 * Creates a long-lived JWT for obtaining new access tokens
 *
 * @param {Object} user - User object
 * @param {string} user._id - User ID
 * @param {Object} options - Additional options
 * @returns {string} Signed JWT refresh token
 */
const generateRefreshToken = (user, options = {}) => {
  if (!user || !user._id) {
    throw new Error("User object with _id is required");
  }

  const payload = {
    id: user._id.toString(),
    type: "refresh",
    // Add a unique identifier to prevent token reuse
    jti: crypto.randomBytes(16).toString("hex"),
  };

  const signOptions = {
    expiresIn: options.expiresIn || config.refreshToken.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
    algorithm: "HS256",
  };

  return jwt.sign(payload, config.refreshToken.secret, signOptions);
};

/**
 * Generate Token Pair
 *
 * Creates both access and refresh tokens
 *
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} Object containing accessToken and refreshToken
 */
const generateTokenPair = (user, options = {}) => {
  return {
    accessToken: generateAccessToken(user, options),
    refreshToken: generateRefreshToken(user, options),
  };
};

/**
 * Generate Password Reset Token
 *
 * Creates a random token for password reset
 *
 * @returns {Object} Object containing token and hashedToken
 */
const generatePasswordResetToken = () => {
  // Generate random token
  const token = crypto.randomBytes(32).toString("hex");

  // Hash token for storage
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Set expiry (1 hour from now)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    token, // Send this to user
    hashedToken, // Store this in database
    expiresAt,
  };
};

/**
 * Generate Email Verification Token
 *
 * Creates a random token for email verification
 *
 * @returns {Object} Object containing token and hashedToken
 */
const generateEmailVerificationToken = () => {
  // Generate random token
  const token = crypto.randomBytes(32).toString("hex");

  // Hash token for storage
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Set expiry (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    token, // Send this to user
    hashedToken, // Store this in database
    expiresAt,
  };
};

/**
 * Generate API Key
 *
 * Creates a random API key for external integrations
 *
 * @param {string} prefix - Optional prefix for the key
 * @returns {Object} Object containing key and hashedKey
 */
const generateApiKey = (prefix = "crs") => {
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const key = `${prefix}_${randomPart}`;

  const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

  return {
    key, // Give this to user (show only once)
    hashedKey, // Store this in database
    createdAt: new Date(),
  };
};

/**
 * Generate Unique ID
 *
 * Creates a unique identifier for various purposes
 *
 * @param {number} length - Length of the ID
 * @returns {string} Unique ID
 */
const generateUniqueId = (length = 16) => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
};

/**
 * Generate Complaint ID
 *
 * Creates a human-readable complaint ID
 *
 * @param {number} sequence - Sequence number
 * @returns {string} Complaint ID (e.g., CMP-2024-00001)
 */
const generateComplaintId = (sequence) => {
  const year = new Date().getFullYear();
  const paddedSequence = String(sequence).padStart(5, "0");
  return `CMP-${year}-${paddedSequence}`;
};

/**
 * Hash Token
 *
 * Hashes a token using SHA256
 *
 * @param {string} token - Token to hash
 * @returns {string} Hashed token
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Compare Tokens
 *
 * Securely compares two tokens
 *
 * @param {string} token1 - First token
 * @param {string} token2 - Second token
 * @returns {boolean} Whether tokens match
 */
const compareTokens = (token1, token2) => {
  if (!token1 || !token2) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(token1), Buffer.from(token2));
  } catch {
    return false;
  }
};

/**
 * Parse Token Expiry
 *
 * Converts expiry string to milliseconds
 *
 * @param {string} expiry - Expiry string (e.g., '15m', '7d')
 * @returns {number} Milliseconds
 */
const parseExpiryToMs = (expiry) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const match = expiry.match(/^(\d+)([smhdw])$/);

  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * units[unit];
};

/**
 * Get Token Expiry Date
 *
 * Calculates expiry date from expiry string
 *
 * @param {string} expiry - Expiry string
 * @returns {Date} Expiry date
 */
const getExpiryDate = (expiry) => {
  const ms = parseExpiryToMs(expiry);
  return new Date(Date.now() + ms);
};

/**
 * Cookie Options for Tokens
 *
 * Returns cookie options based on token type and environment
 *
 * @param {string} tokenType - 'access' or 'refresh'
 * @returns {Object} Cookie options
 */
const getCookieOptions = (tokenType = "access") => {
  const isProduction = process.env.NODE_ENV === "production";
  const expiry =
    tokenType === "refresh"
      ? config.refreshToken.expiresIn
      : config.accessToken.expiresIn;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: parseExpiryToMs(expiry),
    path: "/",
  };
};

/**
 * Set Token Cookies
 *
 * Sets both access and refresh token cookies
 *
 * @param {Object} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
  if (accessToken) {
    res.cookie("accessToken", accessToken, getCookieOptions("access"));
  }

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));
  }
};

/**
 * Clear Token Cookies
 *
 * Clears both access and refresh token cookies
 *
 * @param {Object} res - Express response object
 */
const clearTokenCookies = (res) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  };

  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
};

/**
 * Decode Token Without Verification
 *
 * Decodes a token without verifying signature
 * Useful for debugging or getting payload from expired token
 *
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch {
    return null;
  }
};

/**
 * Get Token Expiration
 *
 * Gets expiration time from token
 *
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
const getTokenExpiration = (token) => {
  const decoded = decodeToken(token);

  if (!decoded || !decoded.payload || !decoded.payload.exp) {
    return null;
  }

  return new Date(decoded.payload.exp * 1000);
};

/**
 * Is Token Expired
 *
 * Checks if token is expired
 *
 * @param {string} token - JWT token
 * @returns {boolean} Whether token is expired
 */
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);

  if (!expiration) {
    return true;
  }

  return expiration < new Date();
};

/**
 * Generate OTP
 *
 * Generates a numeric OTP
 *
 * @param {number} length - Length of OTP (default 6)
 * @returns {Object} Object containing otp and expiresAt
 */
const generateOTP = (length = 6) => {
  const otp = Array.from({ length }, () => Math.floor(Math.random() * 10)).join(
    "",
  );

  return {
    otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  };
};

module.exports = {
  // Token generation
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generateApiKey,
  generateUniqueId,
  generateComplaintId,
  generateOTP,

  // Token utilities
  hashToken,
  compareTokens,
  decodeToken,
  getTokenExpiration,
  isTokenExpired,

  // Expiry utilities
  parseExpiryToMs,
  getExpiryDate,

  // Cookie utilities
  getCookieOptions,
  setTokenCookies,
  clearTokenCookies,

  // Configuration
  config,
};
