/**
 * JWT (JSON Web Token) Configuration
 *
 * This module handles JWT token generation, verification,
 * and configuration for authentication and authorization.
 * Implements access tokens (short-lived) and refresh tokens (long-lived).
 */

const jwt = require("jsonwebtoken");

/**
 * JWT Configuration Constants
 * All values are loaded from environment variables with fallbacks
 */
const jwtConfig = {
  // Access Token Configuration
  accessToken: {
    get secret() {
      if (process.env.NODE_ENV === "production") {
        const sec = process.env.JWT_ACCESS_SECRET;
        if (
          !sec ||
          sec === "your-super-secret-access-key-change-in-production" ||
          sec.length < 32
        ) {
          throw new Error(
            "JWT_ACCESS_SECRET must be configured with a secure secret (>=32 chars) in production.",
          );
        }
        return sec;
      }
      return (
        process.env.JWT_ACCESS_SECRET ||
        "your-super-secret-access-key-change-in-production"
      );
    },
    expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m", // 15 minutes
    algorithm: "HS256",
  },

  // Refresh Token Configuration
  refreshToken: {
    get secret() {
      if (process.env.NODE_ENV === "production") {
        const sec = process.env.JWT_REFRESH_SECRET;
        if (
          !sec ||
          sec === "your-super-secret-refresh-key-change-in-production" ||
          sec.length < 32
        ) {
          throw new Error(
            "JWT_REFRESH_SECRET must be configured with a secure secret (>=32 chars) in production.",
          );
        }
        return sec;
      }
      return (
        process.env.JWT_REFRESH_SECRET ||
        "your-super-secret-refresh-key-change-in-production"
      );
    },
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d", // 7 days
    algorithm: "HS256",
  },

  // Token issuer (your application name/domain)
  issuer: process.env.JWT_ISSUER || "complaint-resolution-system",

  // Token audience (intended recipients)
  audience: process.env.JWT_AUDIENCE || "complaint-resolution-users",
};

/**
 * Generate Access Token
 *
 * Creates a short-lived JWT for API authentication
 *
 * @param {Object} payload - Data to encode in token (user info)
 * @param {string} payload.id - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.role - User role (user, staff, admin)
 * @returns {string} Signed JWT access token
 */
const generateAccessToken = (payload) => {
  // Validate payload
  if (!payload || !payload.id) {
    throw new Error("Invalid payload: User ID is required");
  }

  // Create token payload with standard claims
  const tokenPayload = {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    orgId: payload.organization, // Add organization ID to token
    type: "access",
  };

  // Sign and return the token
  const token = jwt.sign(tokenPayload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
    algorithm: jwtConfig.accessToken.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  });

  return token;
};

/**
 * Generate Refresh Token
 *
 * Creates a long-lived JWT for obtaining new access tokens
 *
 * @param {Object} payload - Data to encode in token
 * @param {string} payload.id - User ID
 * @returns {string} Signed JWT refresh token
 */
const generateRefreshToken = (payload) => {
  // Validate payload
  if (!payload || !payload.id) {
    throw new Error("Invalid payload: User ID is required");
  }

  // Create minimal refresh token payload
  const tokenPayload = {
    id: payload.id,
    type: "refresh",
  };

  // Sign and return the token
  const token = jwt.sign(tokenPayload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
    algorithm: jwtConfig.refreshToken.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  });

  return token;
};

/**
 * Generate Both Access and Refresh Tokens
 *
 * Convenience function to generate both tokens at once
 *
 * @param {Object} user - User object
 * @param {string} user._id - User ID
 * @param {string} user.email - User email
 * @param {string} user.role - User role
 * @returns {Object} Object containing both tokens
 */
const generateTokenPair = (user) => {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verify Access Token
 *
 * Validates and decodes an access token
 *
 * @param {string} token - JWT access token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyAccessToken = (token) => {
  if (!token) {
    throw new Error("Token is required");
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.accessToken.secret, {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    // Verify this is an access token
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      const err = new Error("Access token has expired");
      err.name = "TokenExpiredError";
      err.expiredAt = error.expiredAt;
      throw err;
    }

    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }

    throw error;
  }
};

/**
 * Verify Refresh Token
 *
 * Validates and decodes a refresh token
 *
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  if (!token) {
    throw new Error("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.refreshToken.secret, {
      algorithms: [jwtConfig.refreshToken.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    // Verify this is a refresh token
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      const err = new Error("Refresh token has expired");
      err.name = "TokenExpiredError";
      err.expiredAt = error.expiredAt;
      throw err;
    }

    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }

    throw error;
  }
};

/**
 * Decode Token Without Verification
 *
 * Decodes a token without verifying its signature
 * Useful for debugging or extracting data from expired tokens
 *
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const decodeToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    return null;
  }
};

/**
 * Get Token Expiration Time
 *
 * Calculates when a token will expire
 *
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
const getTokenExpiration = (token) => {
  const decoded = decodeToken(token);

  if (!decoded || !decoded.payload || !decoded.payload.exp) {
    return null;
  }

  return new Date(decoded.payload.exp * 1000);
};

/**
 * Check if Token is Expired
 *
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired
 */
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);

  if (!expiration) {
    return true; // Treat invalid tokens as expired
  }

  return expiration < new Date();
};

/**
 * Extract Token from Authorization Header
 *
 * Parses the Authorization header and extracts the Bearer token
 *
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  // Check for Bearer token format
  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

/**
 * Calculate Token Expiry Duration in Milliseconds
 *
 * Converts JWT expiry strings (e.g., '15m', '7d') to milliseconds
 *
 * @param {string} duration - Duration string
 * @returns {number} Duration in milliseconds
 */
const getExpiryInMs = (duration) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const match = duration.match(/^(\d+)([smhdw])$/);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * units[unit];
};

/**
 * Get Cookie Options for Token Storage
 *
 * Returns secure cookie options based on environment
 *
 * @param {string} tokenType - 'access' or 'refresh'
 * @returns {Object} Cookie options
 */
const getCookieOptions = (tokenType = "access") => {
  const isProduction = process.env.NODE_ENV === "production";
  const config =
    tokenType === "refresh" ? jwtConfig.refreshToken : jwtConfig.accessToken;

  return {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    maxAge: getExpiryInMs(config.expiresIn),
    path: "/",
  };
};

// Export all functions and configuration
module.exports = {
  // Configuration
  jwtConfig,

  // Token Generation
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,

  // Token Verification
  verifyAccessToken,
  verifyRefreshToken,

  // Utility Functions
  decodeToken,
  getTokenExpiration,
  isTokenExpired,
  extractTokenFromHeader,
  getExpiryInMs,
  getCookieOptions,
};
