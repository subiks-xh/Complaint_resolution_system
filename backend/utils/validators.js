/**
 * Custom Validation Functions
 *
 * Provides reusable validation utilities:
 * - Data type validators
 * - Format validators
 * - Business logic validators
 * - Sanitization functions
 */

const mongoose = require("mongoose");

/**
 * ================================
 * Type Validators
 * ================================
 */

/**
 * Check if value is a valid MongoDB ObjectId
 *
 * @param {any} value - Value to check
 * @returns {boolean}
 */
const isValidObjectId = (value) => {
  if (!value) return false;

  if (typeof value === "object" && value._id) {
    return mongoose.Types.ObjectId.isValid(value._id);
  }

  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Check if value is a non-empty string
 *
 * @param {any} value - Value to check
 * @returns {boolean}
 */
const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

/**
 * Check if value is a valid email
 *
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Check if value is a valid phone number
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== "string") return false;

  // Supports various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
  const phoneRegex =
    /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Check if value is a valid URL
 *
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if value is a valid date
 *
 * @param {any} date - Date to validate
 * @returns {boolean}
 */
const isValidDate = (date) => {
  if (!date) return false;

  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
};

/**
 * Check if value is a valid JSON string
 *
 * @param {string} str - String to validate
 * @returns {boolean}
 */
const isValidJSON = (str) => {
  if (typeof str !== "string") return false;

  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if value is a valid hex color
 *
 * @param {string} color - Color to validate
 * @returns {boolean}
 */
const isValidHexColor = (color) => {
  if (!color || typeof color !== "string") return false;

  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color.trim());
};

/**
 * Check if value is a positive integer
 *
 * @param {any} value - Value to check
 * @returns {boolean}
 */
const isPositiveInteger = (value) => {
  if (typeof value === "string") {
    value = parseInt(value, 10);
  }

  return Number.isInteger(value) && value > 0;
};

/**
 * Check if value is within range
 *
 * @param {number} value - Value to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean}
 */
const isInRange = (value, min, max) => {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
};

/**
 * ================================
 * Password Validators
 * ================================
 */

/**
 * Password strength configuration
 */
const passwordConfig = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: "@$!%*?&",
};

/**
 * Check if password meets strength requirements
 *
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with details
 */
const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== "string") {
    return {
      isValid: false,
      errors: ["Password is required"],
      strength: 0,
    };
  }

  // Length check
  if (password.length < passwordConfig.minLength) {
    errors.push(
      `Password must be at least ${passwordConfig.minLength} characters long`,
    );
  }

  if (password.length > passwordConfig.maxLength) {
    errors.push(
      `Password cannot exceed ${passwordConfig.maxLength} characters`,
    );
  }

  // Uppercase check
  if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Lowercase check
  if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Number check
  if (passwordConfig.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Special character check
  if (passwordConfig.requireSpecialChars) {
    const specialRegex = new RegExp(
      `[${passwordConfig.specialChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`,
    );
    if (!specialRegex.test(password)) {
      errors.push(
        `Password must contain at least one special character (${passwordConfig.specialChars})`,
      );
    }
  }

  // Calculate strength (0-4)
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  return {
    isValid: errors.length === 0,
    errors,
    strength: Math.min(strength, 4),
    strengthLabel: ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"][
      Math.min(strength, 4)
    ],
  };
};

/**
 * Check if password is strong (shorthand)
 *
 * @param {string} password - Password to check
 * @returns {boolean}
 */
const isStrongPassword = (password) => {
  return validatePassword(password).isValid;
};

/**
 * ================================
 * Business Logic Validators
 * ================================
 */

/**
 * Valid complaint statuses
 */
const VALID_STATUSES = [
  "new",
  "assigned",
  "in-progress",
  "resolved",
  "closed",
  "escalated",
  "reopened",
];

/**
 * Valid priority levels
 */
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

/**
 * Valid user roles
 */
const VALID_ROLES = ["user", "staff", "admin"];

/**
 * Check if value is a valid complaint status
 *
 * @param {string} status - Status to validate
 * @returns {boolean}
 */
const isValidStatus = (status) => {
  return VALID_STATUSES.includes(status);
};

/**
 * Check if value is a valid priority
 *
 * @param {string} priority - Priority to validate
 * @returns {boolean}
 */
const isValidPriority = (priority) => {
  return VALID_PRIORITIES.includes(priority);
};

/**
 * Check if value is a valid role
 *
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
const isValidRole = (role) => {
  return VALID_ROLES.includes(role);
};

/**
 * Validate status transition
 *
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - New status
 * @param {string} userRole - Role of user making the change
 * @returns {Object} Validation result
 */
const validateStatusTransition = (currentStatus, newStatus, userRole) => {
  // Define valid transitions per role
  const transitions = {
    user: {
      new: ["new"], // Can only update while new
      resolved: ["reopened"], // Can reopen resolved complaints
      closed: ["reopened"], // Can reopen closed complaints (with limits)
    },
    staff: {
      assigned: ["in-progress", "resolved"],
      "in-progress": ["resolved"],
      reopened: ["in-progress", "resolved"],
      escalated: ["in-progress", "resolved"],
    },
    admin: {
      new: ["assigned", "closed"],
      assigned: ["in-progress", "resolved", "closed", "escalated"],
      "in-progress": ["resolved", "closed", "escalated"],
      resolved: ["closed", "reopened"],
      closed: ["reopened"],
      escalated: ["assigned", "in-progress", "resolved", "closed"],
      reopened: ["assigned", "in-progress", "resolved", "closed"],
    },
  };

  const allowedTransitions = transitions[userRole]?.[currentStatus] || [];
  const isValid = allowedTransitions.includes(newStatus);

  return {
    isValid,
    currentStatus,
    newStatus,
    allowedTransitions,
    message: isValid
      ? "Status transition is valid"
      : `Cannot transition from "${currentStatus}" to "${newStatus}" as ${userRole}`,
  };
};

/**
 * Validate complaint data
 *
 * @param {Object} data - Complaint data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result
 */
const validateComplaintData = (data, isUpdate = false) => {
  const errors = [];

  // Title validation
  if (!isUpdate || data.title !== undefined) {
    if (!data.title && !isUpdate) {
      errors.push({ field: "title", message: "Title is required" });
    } else if (data.title) {
      if (typeof data.title !== "string") {
        errors.push({ field: "title", message: "Title must be a string" });
      } else if (data.title.trim().length < 5) {
        errors.push({
          field: "title",
          message: "Title must be at least 5 characters long",
        });
      } else if (data.title.trim().length > 200) {
        errors.push({
          field: "title",
          message: "Title cannot exceed 200 characters",
        });
      }
    }
  }

  // Description validation
  if (!isUpdate || data.description !== undefined) {
    if (!data.description && !isUpdate) {
      errors.push({ field: "description", message: "Description is required" });
    } else if (data.description) {
      if (typeof data.description !== "string") {
        errors.push({
          field: "description",
          message: "Description must be a string",
        });
      } else if (data.description.trim().length < 20) {
        errors.push({
          field: "description",
          message: "Description must be at least 20 characters long",
        });
      } else if (data.description.trim().length > 5000) {
        errors.push({
          field: "description",
          message: "Description cannot exceed 5000 characters",
        });
      }
    }
  }

  // Category validation
  if (!isUpdate || data.category !== undefined) {
    if (!data.category && !isUpdate) {
      errors.push({ field: "category", message: "Category is required" });
    } else if (data.category && !isValidObjectId(data.category)) {
      errors.push({ field: "category", message: "Invalid category ID" });
    }
  }

  // Priority validation
  if (data.priority !== undefined && !isValidPriority(data.priority)) {
    errors.push({
      field: "priority",
      message: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate user registration data
 *
 * @param {Object} data - User data to validate
 * @returns {Object} Validation result
 */
const validateUserRegistration = (data) => {
  const errors = [];

  // Name validation
  if (!data.name) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name must be a string" });
  } else if (data.name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters long",
    });
  } else if (data.name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Name cannot exceed 100 characters",
    });
  }

  // Email validation
  if (!data.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(data.email)) {
    errors.push({ field: "email", message: "Invalid email address" });
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      passwordValidation.errors.forEach((error) => {
        errors.push({ field: "password", message: error });
      });
    }
  }

  // Phone validation (optional)
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({ field: "phone", message: "Invalid phone number" });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate feedback data
 *
 * @param {Object} data - Feedback data to validate
 * @returns {Object} Validation result
 */
const validateFeedbackData = (data) => {
  const errors = [];

  // Complaint ID validation
  if (!data.complaintId) {
    errors.push({ field: "complaintId", message: "Complaint ID is required" });
  } else if (!isValidObjectId(data.complaintId)) {
    errors.push({ field: "complaintId", message: "Invalid complaint ID" });
  }

  // Rating validation
  if (data.rating === undefined || data.rating === null) {
    errors.push({ field: "rating", message: "Rating is required" });
  } else if (!isInRange(data.rating, 1, 5)) {
    errors.push({ field: "rating", message: "Rating must be between 1 and 5" });
  }

  // Comments validation (optional)
  if (
    data.comments &&
    typeof data.comments === "string" &&
    data.comments.length > 2000
  ) {
    errors.push({
      field: "comments",
      message: "Comments cannot exceed 2000 characters",
    });
  }

  // Rating breakdown validation (optional)
  if (data.ratingBreakdown) {
    const breakdownFields = [
      "responseTime",
      "resolution",
      "communication",
      "professionalism",
    ];

    for (const field of breakdownFields) {
      if (
        data.ratingBreakdown[field] !== undefined &&
        !isInRange(data.ratingBreakdown[field], 1, 5)
      ) {
        errors.push({
          field: `ratingBreakdown.${field}`,
          message: `${field} rating must be between 1 and 5`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * ================================
 * Sanitization Functions
 * ================================
 */

/**
 * Sanitize HTML/script tags from string
 *
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeHtml = (str) => {
  if (typeof str !== "string") return str;

  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
};

/**
 * Sanitize object recursively
 *
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeHtml(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize filename
 *
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (typeof filename !== "string") return "file";

  return (
    filename
      .replace(/[^a-zA-Z0-9.-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 255) || "file"
  );
};

/**
 * Normalize email
 *
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 */
const normalizeEmail = (email) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

/**
 * Trim and normalize whitespace
 *
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
const normalizeWhitespace = (str) => {
  if (typeof str !== "string") return str;
  return str.trim().replace(/\s+/g, " ");
};

/**
 * ================================
 * Array Validators
 * ================================
 */

/**
 * Check if array contains only valid ObjectIds
 *
 * @param {Array} arr - Array to check
 * @returns {boolean}
 */
const isArrayOfObjectIds = (arr) => {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => isValidObjectId(item));
};

/**
 * Check if array contains only strings
 *
 * @param {Array} arr - Array to check
 * @returns {boolean}
 */
const isArrayOfStrings = (arr) => {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => typeof item === "string");
};

/**
 * Check if array has unique values
 *
 * @param {Array} arr - Array to check
 * @returns {boolean}
 */
const hasUniqueValues = (arr) => {
  if (!Array.isArray(arr)) return false;
  return new Set(arr).size === arr.length;
};

/**
 * Remove duplicates from array
 *
 * @param {Array} arr - Array to process
 * @returns {Array} Array with unique values
 */
const removeDuplicates = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr)];
};

/**
 * ================================
 * Date Validators
 * ================================
 */

/**
 * Check if date is in the future
 *
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
const isFutureDate = (date) => {
  const parsed = new Date(date);
  return isValidDate(date) && parsed > new Date();
};

/**
 * Check if date is in the past
 *
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
const isPastDate = (date) => {
  const parsed = new Date(date);
  return isValidDate(date) && parsed < new Date();
};

/**
 * Check if date is within range
 *
 * @param {Date|string} date - Date to check
 * @param {Date|string} startDate - Start of range
 * @param {Date|string} endDate - End of range
 * @returns {boolean}
 */
const isDateInRange = (date, startDate, endDate) => {
  const parsed = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);

  return isValidDate(date) && parsed >= start && parsed <= end;
};

/**
 * Validate date range
 *
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} Validation result
 */
const validateDateRange = (startDate, endDate) => {
  const errors = [];

  if (!isValidDate(startDate)) {
    errors.push({ field: "startDate", message: "Invalid start date" });
  }

  if (!isValidDate(endDate)) {
    errors.push({ field: "endDate", message: "Invalid end date" });
  }

  if (errors.length === 0 && new Date(startDate) > new Date(endDate)) {
    errors.push({
      field: "dateRange",
      message: "Start date must be before end date",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * ================================
 * File Validators
 * ================================
 */

/**
 * Allowed file types configuration
 */
const allowedFileTypes = {
  images: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  documents: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    extensions: [".pdf", ".doc", ".docx", ".txt"],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  all: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    extensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

/**
 * Validate file
 *
 * @param {Object} file - File object (from multer)
 * @param {string} type - File type category ('images', 'documents', 'all')
 * @returns {Object} Validation result
 */
const validateFile = (file, type = "all") => {
  const errors = [];
  const config = allowedFileTypes[type] || allowedFileTypes.all;

  if (!file) {
    return {
      isValid: false,
      errors: [{ field: "file", message: "File is required" }],
    };
  }

  // Check MIME type
  if (!config.mimeTypes.includes(file.mimetype)) {
    errors.push({
      field: "file",
      message: `Invalid file type. Allowed types: ${config.extensions.join(", ")}`,
    });
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxSizeMB = config.maxSize / (1024 * 1024);
    errors.push({
      field: "file",
      message: `File size exceeds maximum allowed (${maxSizeMB}MB)`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate multiple files
 *
 * @param {Array} files - Array of file objects
 * @param {string} type - File type category
 * @param {number} maxCount - Maximum number of files
 * @returns {Object} Validation result
 */
const validateFiles = (files, type = "all", maxCount = 5) => {
  const errors = [];

  if (!files || !Array.isArray(files)) {
    return { isValid: true, errors: [] }; // Files are optional
  }

  if (files.length > maxCount) {
    errors.push({
      field: "files",
      message: `Maximum ${maxCount} files allowed`,
    });
  }

  files.forEach((file, index) => {
    const result = validateFile(file, type);
    if (!result.isValid) {
      result.errors.forEach((error) => {
        errors.push({
          field: `files[${index}]`,
          message: error.message,
        });
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  // Type validators
  isValidObjectId,
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidDate,
  isValidJSON,
  isValidHexColor,
  isPositiveInteger,
  isInRange,

  // Password validators
  passwordConfig,
  validatePassword,
  isStrongPassword,

  // Business logic validators
  VALID_STATUSES,
  VALID_PRIORITIES,
  VALID_ROLES,
  isValidStatus,
  isValidPriority,
  isValidRole,
  validateStatusTransition,
  validateComplaintData,
  validateUserRegistration,
  validateFeedbackData,

  // Sanitization
  sanitizeHtml,
  sanitizeObject,
  sanitizeFilename,
  normalizeEmail,
  normalizeWhitespace,

  // Array validators
  isArrayOfObjectIds,
  isArrayOfStrings,
  hasUniqueValues,
  removeDuplicates,

  // Date validators
  isFutureDate,
  isPastDate,
  isDateInRange,
  validateDateRange,

  // File validators
  allowedFileTypes,
  validateFile,
  validateFiles,
};
