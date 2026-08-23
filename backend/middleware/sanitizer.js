/**
 * Input Sanitization Middleware
 *
 * Prevents XSS attacks by sanitizing user input
 */

const sanitizeHtml = require("sanitize-html");

/**
 * Configuration for sanitizeHtml
 */
const sanitizeConfig = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

/**
 * Sanitize a single string
 * @param {String} input - String to sanitize
 * @returns {String} Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== "string") {
    return input;
  }

  // First remove HTML
  const cleaned = sanitizeHtml(input, sanitizeConfig);
  // Escape special characters
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
};

/**
 * Recursively sanitize all string values in an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Express middleware to sanitize request body and query parameters
 */
const sanitizeMiddleware = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    console.error("Error during sanitization:", error);
    res.status(400).json({
      success: false,
      message: "Invalid input format",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Sanitize specific fields in an object
 * @param {Object} obj - Object containing fields to sanitize
 * @param {Array} fields - Array of field names to sanitize
 * @returns {Object} Object with sanitized fields
 */
const sanitizeFields = (obj, fields = []) => {
  const sanitized = { ...obj };

  fields.forEach((field) => {
    if (sanitized.hasOwnProperty(field)) {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  });

  return sanitized;
};

/**
 * Sanitize rich text/markdown content
 * Allows basic formatting but no scripts
 */
const sanitizeRichText = (input) => {
  if (typeof input !== "string") {
    return input;
  }

  const richTextConfig = {
    allowedTags: ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li", "a"],
    allowedAttributes: {
      a: ["href", "title"],
    },
    disallowedTagsMode: "discard",
  };

  return sanitizeHtml(input, richTextConfig);
};

module.exports = {
  sanitizeMiddleware,
  sanitizeString,
  sanitizeObject,
  sanitizeFields,
  sanitizeRichText,
};

// Export middleware for direct use: app.use(sanitizeMiddleware)
module.exports.default = sanitizeMiddleware;
