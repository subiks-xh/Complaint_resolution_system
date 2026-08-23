/**
 * Request Validation Middleware
 *
 * Handles request validation using express-validator:
 * - Input sanitization
 * - Data validation
 * - Custom validators
 * - Validation schemas for all routes
 */

const {
  body,
  param,
  query,
  validationResult,
  check,
} = require("express-validator");
const mongoose = require("mongoose");

/**
 * Process validation results
 * Returns errors if validation failed, otherwise continues
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
      location: err.location,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: formattedErrors,
    });
  }

  next();
};

/**
 * Custom Validators
 */

// Check if value is a valid MongoDB ObjectId
const isValidObjectId = (value) => {
  if (!value) return true; // Let required check handle empty values
  return mongoose.Types.ObjectId.isValid(value);
};

// Check if value is a valid priority
const isValidPriority = (value) => {
  return ["low", "medium", "high", "critical"].includes(value);
};

// Check if value is a valid complaint status
const isValidStatus = (value) => {
  return [
    "new",
    "assigned",
    "in-progress",
    "resolved",
    "closed",
    "escalated",
    "reopened",
  ].includes(value);
};

// Check if value is a valid role
const isValidRole = (value) => {
  return ["user", "staff", "org_admin", "super_admin", "admin"].includes(
    value,
  );
};

// Check password strength
const isStrongPassword = (value) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(value);
};

// Check if array contains only valid ObjectIds
const isArrayOfObjectIds = (value) => {
  if (!Array.isArray(value)) return false;
  return value.every((id) => mongoose.Types.ObjectId.isValid(id));
};

// Sanitize HTML/script tags
const sanitizeInput = (value) => {
  if (typeof value !== "string") return value;
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
};

/**
 * ================================
 * Authentication Validation Schemas
 * ================================
 */

const authValidation = {
  // Register validation
  register: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage("Email cannot exceed 255 characters"),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .custom(isStrongPassword)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)",
      ),

    body("phone")
      .optional()
      .trim()
      .matches(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage("Please provide a valid phone number"),

    body("department")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Department cannot exceed 100 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Login validation
  login: [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),

    body("password").notEmpty().withMessage("Password is required"),

    validate,
  ],

  // Forgot password validation
  forgotPassword: [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),

    validate,
  ],

  // Reset password validation
  resetPassword: [
    param("token")
      .notEmpty()
      .withMessage("Reset token is required")
      .isLength({ min: 20 })
      .withMessage("Invalid reset token"),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .custom(isStrongPassword)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),

    body("confirmPassword")
      .notEmpty()
      .withMessage("Please confirm your password")
      .custom((value, { req }) => value === req.body.password)
      .withMessage("Passwords do not match"),

    validate,
  ],

  // Change password validation
  changePassword: [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),

    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .custom(isStrongPassword)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      )
      .custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage("New password must be different from current password"),

    body("confirmPassword")
      .notEmpty()
      .withMessage("Please confirm your new password")
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage("Passwords do not match"),

    validate,
  ],

  // Register staff validation (admin only)
  registerStaff: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),

    body("department")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Department cannot exceed 100 characters"),

    body("designation")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Designation cannot exceed 100 characters"),

    body("specializations")
      .optional()
      .isArray()
      .withMessage("Specializations must be an array")
      .custom(isArrayOfObjectIds)
      .withMessage("Invalid specialization IDs"),

    body("maxAssignedComplaints")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Max assigned complaints must be between 1 and 50"),

    validate,
  ],
};

/**
 * ================================
 * User Validation Schemas
 * ================================
 */

const userValidation = {
  // Update profile validation
  updateProfile: [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("phone")
      .optional()
      .trim()
      .custom((value) => {
        if (!value || value === "") return true;
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(
          value,
        );
      })
      .withMessage("Please provide a valid phone number"),

    body("department")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Department cannot exceed 100 characters")
      .customSanitizer(sanitizeInput),

    body("notificationPreferences")
      .optional()
      .isObject()
      .withMessage("Notification preferences must be an object"),

    body("notificationPreferences.email")
      .optional()
      .isBoolean()
      .withMessage("Email preference must be a boolean"),

    body("notificationPreferences.inApp")
      .optional()
      .isBoolean()
      .withMessage("In-app preference must be a boolean"),

    validate,
  ],

  // Update user by ID (admin)
  updateUserById: [
    param("id")
      .notEmpty()
      .withMessage("User ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid user ID"),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),

    body("role")
      .optional()
      .custom(isValidRole)
      .withMessage("Invalid role. Must be user, staff, or admin"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),

    body("department")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Department cannot exceed 100 characters"),

    validate,
  ],

  // Notification preferences
  updateNotificationPreferences: [
    body("email")
      .optional()
      .isBoolean()
      .withMessage("Email preference must be a boolean"),

    body("inApp")
      .optional()
      .isBoolean()
      .withMessage("In-app preference must be a boolean"),

    body("complaintUpdates")
      .optional()
      .isBoolean()
      .withMessage("Complaint updates preference must be a boolean"),

    body("escalationAlerts")
      .optional()
      .isBoolean()
      .withMessage("Escalation alerts preference must be a boolean"),

    validate,
  ],

  // Deactivate account
  deactivateAccount: [
    body("password")
      .notEmpty()
      .withMessage("Password is required to confirm account deactivation"),

    validate,
  ],

  // Add staff feedback validation (user side)
  addStaffFeedback: [
    body("rating")
      .notEmpty()
      .withMessage("Rating is required")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),

    body("comment")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Comment cannot exceed 2000 characters")
      .customSanitizer(sanitizeInput),

    body("category")
      .optional()
      .isIn([
        "general",
        "communication",
        "technical",
        "timeliness",
        "problem_solving",
        "attitude",
        "customer_service",
      ])
      .withMessage("Invalid feedback category"),

    body("isAnonymous")
      .optional()
      .isBoolean()
      .withMessage("isAnonymous must be a boolean"),

    body("relatedComplaint")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    validate,
  ],
};

/**
 * ================================
 * Complaint Validation Schemas
 * ================================
 */

const complaintValidation = {
  // Create complaint validation
  create: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ min: 5, max: 200 })
      .withMessage("Title must be between 5 and 200 characters")
      .customSanitizer(sanitizeInput),

    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required")
      .isLength({ min: 20, max: 5000 })
      .withMessage("Description must be between 20 and 5000 characters")
      .customSanitizer(sanitizeInput),

    body("category")
      .notEmpty()
      .withMessage("Category is required")
      .custom(isValidObjectId)
      .withMessage("Invalid category ID"),

    body("priority")
      .optional()
      .custom(isValidPriority)
      .withMessage("Priority must be low, medium, high, or critical"),

    body("location")
      .optional()
      .custom((value) => {
        if (typeof value === "string") return true;
        if (typeof value === "object") return true;
        return false;
      })
      .withMessage("Location must be a string or object"),

    body("location.building")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Building cannot exceed 100 characters"),

    body("location.floor")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Floor cannot exceed 50 characters"),

    body("location.room")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Room cannot exceed 50 characters"),

    body("tags")
      .optional()
      .custom((value) => {
        if (typeof value === "string") return true;
        if (Array.isArray(value)) return true;
        return false;
      })
      .withMessage("Tags must be a string or array"),

    validate,
  ],

  // Update complaint validation
  update: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("title")
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage("Title must be between 5 and 200 characters")
      .customSanitizer(sanitizeInput),

    body("description")
      .optional()
      .trim()
      .isLength({ min: 20, max: 5000 })
      .withMessage("Description must be between 20 and 5000 characters")
      .customSanitizer(sanitizeInput),

    body("priority")
      .optional()
      .custom(isValidPriority)
      .withMessage("Priority must be low, medium, high, or critical"),

    validate,
  ],

  // Get complaint by ID validation
  getById: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom((value) => {
        // Allow both ObjectId and complaintId (e.g., CMP-2024-00001)
        return isValidObjectId(value) || /^CMP-\d{4}-\d{5}$/i.test(value);
      })
      .withMessage("Invalid complaint ID"),

    validate,
  ],

  // Cancel complaint validation
  cancel: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Reason cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Reopen complaint validation
  reopen: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Reason for reopening is required")
      .isLength({ min: 10, max: 1000 })
      .withMessage("Reason must be between 10 and 1000 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // List complaints query validation
  list: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),

    query("status")
      .optional()
      .custom((value) => {
        const statuses = value.split(",");
        return statuses.every(isValidStatus);
      })
      .withMessage("Invalid status value"),

    query("priority")
      .optional()
      .custom((value) => {
        const priorities = value.split(",");
        return priorities.every(isValidPriority);
      })
      .withMessage("Invalid priority value"),

    query("category")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid category ID"),

    query("sortBy")
      .optional()
      .isIn(["createdAt", "updatedAt", "priority", "status", "title"])
      .withMessage("Invalid sort field"),

    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),

    validate,
  ],

  // Delete attachment validation
  deleteAttachment: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    param("attachmentId")
      .notEmpty()
      .withMessage("Attachment ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid attachment ID"),

    validate,
  ],
};

/**
 * ================================
 * Staff Validation Schemas
 * ================================
 */

const staffValidation = {
  // Update status validation
  updateStatus: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("status")
      .notEmpty()
      .withMessage("Status is required")
      .isIn(["in-progress", "resolved"])
      .withMessage("Status must be in-progress or resolved"),

    body("remarks")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Remarks cannot exceed 2000 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Add internal note validation
  addNote: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("note")
      .trim()
      .notEmpty()
      .withMessage("Note is required")
      .isLength({ min: 5, max: 1000 })
      .withMessage("Note must be between 5 and 1000 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Resolve complaint validation
  resolve: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("remarks")
      .trim()
      .notEmpty()
      .withMessage("Resolution remarks are required")
      .isLength({ min: 20, max: 2000 })
      .withMessage("Resolution remarks must be between 20 and 2000 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Request reassignment validation
  requestReassignment: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Reason for reassignment is required")
      .isLength({ min: 20, max: 500 })
      .withMessage("Reason must be between 20 and 500 characters")
      .customSanitizer(sanitizeInput),

    body("suggestedStaffId")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid suggested staff ID"),

    validate,
  ],

  // Delete note validation
  deleteNote: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    param("noteId")
      .notEmpty()
      .withMessage("Note ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid note ID"),

    validate,
  ],
};

/**
 * ================================
 * Admin Validation Schemas
 * ================================
 */

const adminValidation = {
  // Assign complaint validation
  assign: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("staffId")
      .notEmpty()
      .withMessage("Staff ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID"),

    body("remarks")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Remarks cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    body("priority")
      .optional()
      .custom(isValidPriority)
      .withMessage("Invalid priority value"),

    validate,
  ],

  // Create organization validation
  createOrganization: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),

    body("address")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Address cannot exceed 200 characters")
      .customSanitizer(sanitizeInput),

    body("settings")
      .optional()
      .isObject()
      .withMessage("Settings must be an object"),

    validate,
  ],

  // Reassign complaint validation
  reassign: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("staffId")
      .notEmpty()
      .withMessage("Staff ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID"),

    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Reassignment reason is required")
      .isLength({ min: 10, max: 500 })
      .withMessage("Reason must be between 10 and 500 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Bulk assign validation
  bulkAssign: [
    body("assignments")
      .isArray({ min: 1 })
      .withMessage("Assignments array is required and cannot be empty"),

    body("assignments.*.complaintId")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("assignments.*.staffId")
      .notEmpty()
      .withMessage("Staff ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID"),

    validate,
  ],

  // Escalate complaint validation
  escalate: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Escalation reason is required")
      .isLength({ min: 10, max: 500 })
      .withMessage("Reason must be between 10 and 500 characters")
      .customSanitizer(sanitizeInput),

    body("reassignTo")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID for reassignment"),

    validate,
  ],

  // Close complaint validation
  close: [
    param("id")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("remarks")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Remarks cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Update staff status validation
  updateStaffStatus: [
    param("id")
      .notEmpty()
      .withMessage("Staff ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID"),

    body("isActive")
      .notEmpty()
      .withMessage("isActive status is required")
      .isBoolean()
      .withMessage("isActive must be a boolean"),

    validate,
  ],

  // Update staff specializations validation
  updateStaffSpecializations: [
    param("id")
      .notEmpty()
      .withMessage("Staff ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid staff ID"),

    body("specializations")
      .optional()
      .isArray()
      .withMessage("Specializations must be an array")
      .custom(isArrayOfObjectIds)
      .withMessage("Invalid specialization IDs"),

    body("maxAssignedComplaints")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Max assigned complaints must be between 1 and 50"),

    validate,
  ],

  // Create announcement validation
  createAnnouncement: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ min: 5, max: 200 })
      .withMessage("Title must be between 5 and 200 characters")
      .customSanitizer(sanitizeInput),

    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ min: 10, max: 1000 })
      .withMessage("Message must be between 10 and 1000 characters")
      .customSanitizer(sanitizeInput),

    body("targetRole")
      .optional()
      .custom((value) => {
        return ["all", "user", "staff", "org_admin", "super_admin", "admin"].includes(value);
      })
      .withMessage(
        "Target role must be all, user, staff, org_admin, or super_admin",
      ),

    body("priority")
      .optional()
      .isIn(["low", "normal", "high", "urgent"])
      .withMessage("Priority must be low, normal, high, or urgent"),

    validate,
  ],

  // Add feedback validation
  addFeedback: [
    body("rating")
      .notEmpty()
      .withMessage("Rating is required")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),

    body("comment")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Comment cannot exceed 2000 characters")
      .customSanitizer(sanitizeInput),

    body("category")
      .optional()
      .isIn([
        "general",
        "communication",
        "technical",
        "timeliness",
        "problem_solving",
        "attitude",
        "teamwork",
        "leadership",
        "customer_service",
      ])
      .withMessage("Invalid feedback category"),

    body("isAnonymous")
      .optional()
      .isBoolean()
      .withMessage("isAnonymous must be a boolean"),

    body("relatedComplaint")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    validate,
  ],

  // Analytics query validation
  analyticsQuery: [
    query("days")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Days must be between 1 and 365"),

    query("currentStart")
      .optional()
      .isISO8601()
      .withMessage("currentStart must be a valid ISO 8601 date"),

    query("currentEnd")
      .optional()
      .isISO8601()
      .withMessage("currentEnd must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (req.query.currentStart && value) {
          return new Date(value) >= new Date(req.query.currentStart);
        }
        return true;
      })
      .withMessage("currentEnd must be after or equal to currentStart"),

    validate,
  ],

  // Reports query validation
  reportsQuery: [
    query("category")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid category ID"),

    query("priority")
      .optional()
      .custom(isValidPriority)
      .withMessage("Priority must be low, medium, high, or critical"),

    query("status")
      .optional()
      .custom(isValidStatus)
      .withMessage("Invalid complaint status value"),

    query("format")
      .optional()
      .isIn(["json", "csv", "pdf"])
      .withMessage("Format must be json, csv, or pdf"),

    validate,
  ],

  // Bulk import request validation
  importPayload: [
    body("csv").optional().isString().withMessage("CSV must be a string"),

    body("rows")
      .optional()
      .isArray({ min: 1, max: 5000 })
      .withMessage("Rows must be an array with 1 to 5000 items"),

    body("organization")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid organization ID"),

    body()
      .custom((value) => {
        const hasCsv =
          typeof value?.csv === "string" && value.csv.trim().length > 0;
        const hasRows = Array.isArray(value?.rows) && value.rows.length > 0;
        return hasCsv || hasRows;
      })
      .withMessage("Provide either csv text or rows array for import"),

    validate,
  ],
};

/**
 * ================================
 * Feedback Validation Schemas
 * ================================
 */

const feedbackValidation = {
  // Submit feedback validation
  submit: [
    body("complaintId")
      .notEmpty()
      .withMessage("Complaint ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid complaint ID"),

    body("rating")
      .notEmpty()
      .withMessage("Rating is required")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),

    body("comments")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Comments cannot exceed 2000 characters")
      .customSanitizer(sanitizeInput),

    body("ratingBreakdown")
      .optional()
      .isObject()
      .withMessage("Rating breakdown must be an object"),

    body("ratingBreakdown.responseTime")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Response time rating must be between 1 and 5"),

    body("ratingBreakdown.resolution")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Resolution rating must be between 1 and 5"),

    body("ratingBreakdown.communication")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Communication rating must be between 1 and 5"),

    body("ratingBreakdown.professionalism")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Professionalism rating must be between 1 and 5"),

    body("wouldRecommend")
      .optional()
      .isBoolean()
      .withMessage("Would recommend must be a boolean"),

    body("positiveAspects")
      .optional()
      .isArray()
      .withMessage("Positive aspects must be an array"),

    body("improvementAreas")
      .optional()
      .isArray()
      .withMessage("Improvement areas must be an array"),

    body("issueResolved")
      .optional()
      .isBoolean()
      .withMessage("Issue resolved must be a boolean"),

    body("needsFollowUp")
      .optional()
      .isBoolean()
      .withMessage("Needs follow up must be a boolean"),

    body("followUpReason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Follow up reason cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    body("isAnonymous")
      .optional()
      .isBoolean()
      .withMessage("Is anonymous must be a boolean"),

    validate,
  ],

  // Respond to feedback validation
  respond: [
    param("id")
      .notEmpty()
      .withMessage("Feedback ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid feedback ID"),

    body("response")
      .trim()
      .notEmpty()
      .withMessage("Response is required")
      .isLength({ min: 10, max: 1000 })
      .withMessage("Response must be between 10 and 1000 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],

  // Flag feedback validation
  flag: [
    param("id")
      .notEmpty()
      .withMessage("Feedback ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid feedback ID"),

    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Flag reason is required")
      .isLength({ min: 10, max: 500 })
      .withMessage("Reason must be between 10 and 500 characters")
      .customSanitizer(sanitizeInput),

    validate,
  ],
};

/**
 * ================================
 * Category Validation Schemas
 * ================================
 */

const categoryValidation = {
  // Create category validation
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Category name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    body("icon")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Icon name cannot exceed 50 characters"),

    body("color")
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage("Invalid color format. Use hex color (e.g., #FF5733)"),

    body("parent")
      .optional()
      .custom(isValidObjectId)
      .withMessage("Invalid parent category ID"),

    body("department")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Department cannot exceed 100 characters"),

    body("resolutionSLA")
      .optional()
      .isObject()
      .withMessage("Resolution SLA must be an object"),

    body("resolutionSLA.low")
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage("Low priority SLA must be between 1 and 720 hours"),

    body("resolutionSLA.medium")
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage("Medium priority SLA must be between 1 and 720 hours"),

    body("resolutionSLA.high")
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage("High priority SLA must be between 1 and 720 hours"),

    body("resolutionSLA.critical")
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage("Critical priority SLA must be between 1 and 720 hours"),

    body("defaultPriority")
      .optional()
      .custom(isValidPriority)
      .withMessage("Invalid default priority"),

    body("keywords")
      .optional()
      .isArray()
      .withMessage("Keywords must be an array"),

    validate,
  ],

  // Update category validation
  update: [
    param("id")
      .notEmpty()
      .withMessage("Category ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid category ID"),

    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .customSanitizer(sanitizeInput),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters")
      .customSanitizer(sanitizeInput),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),

    validate,
  ],

  // Get category validation
  getById: [
    param("identifier")
      .notEmpty()
      .withMessage("Category ID or slug is required"),

    validate,
  ],

  // Update keywords validation
  updateKeywords: [
    param("id")
      .notEmpty()
      .withMessage("Category ID is required")
      .custom(isValidObjectId)
      .withMessage("Invalid category ID"),

    body("keywords").isArray().withMessage("Keywords must be an array"),

    body("action")
      .optional()
      .isIn(["set", "add", "remove"])
      .withMessage("Action must be set, add, or remove"),

    validate,
  ],

  // Suggest category validation
  suggest: [
    body("text")
      .trim()
      .notEmpty()
      .withMessage("Text is required")
      .isLength({ min: 10 })
      .withMessage("Text must be at least 10 characters"),

    validate,
  ],
};

/**
 * ================================
 * Common Validation Schemas
 * ================================
 */

const commonValidation = {
  // Pagination query validation
  pagination: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),

    validate,
  ],

  // ObjectId param validation
  objectIdParam: (paramName = "id") => [
    param(paramName)
      .notEmpty()
      .withMessage(`${paramName} is required`)
      .custom(isValidObjectId)
      .withMessage(`Invalid ${paramName}`),

    validate,
  ],

  // Search query validation
  search: [
    query("q")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Search query must be between 2 and 100 characters"),

    validate,
  ],

  // Date range validation
  dateRange: [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),

    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (req.query.startDate && value) {
          return new Date(value) >= new Date(req.query.startDate);
        }
        return true;
      })
      .withMessage("End date must be after start date"),

    validate,
  ],
};

module.exports = {
  // Main validate function
  validate,

  // Custom validators
  isValidObjectId,
  isValidPriority,
  isValidStatus,
  isValidRole,
  isStrongPassword,
  sanitizeInput,

  // Validation schemas
  authValidation,
  userValidation,
  complaintValidation,
  staffValidation,
  adminValidation,
  feedbackValidation,
  categoryValidation,
  commonValidation,
};
