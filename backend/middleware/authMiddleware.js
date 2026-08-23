/**
 * Authentication Middleware
 *
 * Handles JWT verification and user authentication:
 * - Token extraction from headers/cookies
 * - Token verification and validation
 * - User attachment to request
 * - Token refresh handling
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyAccessToken, extractTokenFromHeader } = require("../config/jwt");

/**
 * Protect routes - Require authentication
 * Verifies JWT token and attaches user to request
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = extractTokenFromHeader(req.headers.authorization);
    }
    // 2. Fallback to cookie (for web clients)
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No authentication token provided.",
        code: "NO_TOKEN",
      });
    }

    try {
      // Verify token
      const decoded = verifyAccessToken(token);

      // Check if user still exists and is active
      const user = await User.findById(decoded.id).select(
        "-password -refreshToken",
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User associated with this token no longer exists.",
          code: "USER_NOT_FOUND",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact support.",
          code: "ACCOUNT_DEACTIVATED",
        });
      }

      // Check if password was changed after token was issued
      if (user.passwordChangedAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          message: "Password was recently changed. Please login again.",
          code: "PASSWORD_CHANGED",
        });
      }

      // Attach user to request
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isEmailVerified: user.isEmailVerified,
        organization: user.organization ? user.organization.toString() : null,
      };

      // Attach full user document for cases where it's needed
      req.userDoc = user;

      next();
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Your session has expired. Please login again.",
          code: "TOKEN_EXPIRED",
          expiredAt: error.expiredAt,
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication token.",
          code: "INVALID_TOKEN",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error. Please try again.",
      code: "AUTH_ERROR",
    });
  }
};

/**
 * Optional authentication
 * Attaches user to request if token is valid, but doesn't require it
 * Useful for routes that work for both authenticated and unauthenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Extract token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = extractTokenFromHeader(req.headers.authorization);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // If no token, continue without user
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = verifyAccessToken(token);

      // Get user
      const user = await User.findById(decoded.id).select(
        "-password -refreshToken",
      );

      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          isEmailVerified: user.isEmailVerified,
        };
        req.userDoc = user;
      } else {
        req.user = null;
      }
    } catch (error) {
      // Token invalid or expired - continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    req.user = null;
    next();
  }
};

/**
 * Require email verification
 * Must be used after protect middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to access this resource.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  next();
};

/**
 * Check if user owns the resource or is admin
 * Factory function that creates middleware for specific resource types
 *
 * @param {Function} getResourceOwnerId - Function to extract owner ID from request
 * @returns {Function} Middleware function
 */
const requireOwnershipOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
          code: "AUTH_REQUIRED",
        });
      }

      // Admins can access any resource
      if (req.user.role === "admin") {
        return next();
      }

      // Get resource owner ID
      const ownerId = await getResourceOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Resource not found.",
        });
      }

      // Check ownership
      if (ownerId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource.",
          code: "NOT_OWNER",
        });
      }

      next();
    } catch (error) {
      console.error("Ownership check error:", error);
      return res.status(500).json({
        success: false,
        message: "Error checking resource ownership.",
      });
    }
  };
};

/**
 * Rate limiting for sensitive operations
 * Tracks attempts per user/IP for operations like password reset
 */
const sensitiveOperationLimiter = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Cleanup old entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of attempts.entries()) {
      if (now - data.firstAttempt > WINDOW_MS) {
        attempts.delete(key);
      }
    }
  }, 60 * 1000); // Clean every minute

  // Avoid keeping test/runtime process alive solely because of this housekeeping timer.
  if (typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const identifier = req.user?.id || req.ip;
    const key = `${identifier}-${req.path}`;
    const now = Date.now();

    const data = attempts.get(key);

    if (!data) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    // Reset if window has passed
    if (now - data.firstAttempt > WINDOW_MS) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    // Increment and check
    data.count++;

    if (data.count > MAX_ATTEMPTS) {
      const retryAfter = Math.ceil(
        (WINDOW_MS - (now - data.firstAttempt)) / 1000,
      );

      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      });
    }

    next();
  };
})();

/**
 * Attach user stats to request
 * Useful for dashboard and profile routes
 */
const attachUserStats = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const Complaint = require("../models/Complaint");
    const Notification = require("../models/Notification");
    const mongoose = require("mongoose");

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get basic stats based on role
    const [complaintStats, unreadNotifications] = await Promise.all([
      // Complaint stats based on role
      req.user.role === "staff"
        ? Complaint.aggregate([
            { $match: { assignedTo: userId } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ])
        : Complaint.aggregate([
            { $match: { user: userId } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ]),

      // Unread notifications count
      Notification.countDocuments({
        recipient: userId,
        isRead: false,
        isArchived: false,
      }),
    ]);

    req.userStats = {
      complaints: complaintStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      unreadNotifications,
    };

    next();
  } catch (error) {
    console.error("Attach user stats error:", error);
    // Don't fail the request, just continue without stats
    req.userStats = null;
    next();
  }
};

/**
 * Verify API key for external integrations
 * Used for webhook endpoints or external API access
 */
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "API key is required.",
      code: "NO_API_KEY",
    });
  }

  // Validate against stored API keys
  const validApiKeys = process.env.API_KEYS?.split(",") || [];

  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key.",
      code: "INVALID_API_KEY",
    });
  }

  // Attach API key info to request
  req.apiKey = apiKey;
  req.isApiAccess = true;

  next();
};

/**
 * Combined auth - Accept either JWT or API key
 */
const authOrApiKey = async (req, res, next) => {
  // Check for API key first
  if (req.headers["x-api-key"]) {
    return verifyApiKey(req, res, next);
  }

  // Fall back to JWT auth
  return protect(req, res, next);
};

module.exports = {
  protect,
  optionalAuth,
  requireEmailVerification,
  requireOwnershipOrAdmin,
  sensitiveOperationLimiter,
  attachUserStats,
  verifyApiKey,
  authOrApiKey,
};
