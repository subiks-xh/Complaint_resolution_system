/**
 * Application Constants
 *
 * Centralized constants for the application:
 * - Statuses, priorities, roles
 * - Configuration values
 * - Error codes
 * - Message templates
 */

/**
 * ================================
 * Complaint Constants
 * ================================
 */

/**
 * Complaint Status Values
 */
const COMPLAINT_STATUS = {
  NEW: "new",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
  ESCALATED: "escalated",
  REOPENED: "reopened",
};

/**
 * All complaint statuses as array
 */
const COMPLAINT_STATUSES = Object.values(COMPLAINT_STATUS);

/**
 * Active complaint statuses (not resolved/closed)
 */
const ACTIVE_COMPLAINT_STATUSES = [
  COMPLAINT_STATUS.NEW,
  COMPLAINT_STATUS.ASSIGNED,
  COMPLAINT_STATUS.IN_PROGRESS,
  COMPLAINT_STATUS.ESCALATED,
  COMPLAINT_STATUS.REOPENED,
];

/**
 * Resolved/Closed statuses
 */
const COMPLETED_COMPLAINT_STATUSES = [
  COMPLAINT_STATUS.RESOLVED,
  COMPLAINT_STATUS.CLOSED,
];

/**
 * Status labels for display
 */
const COMPLAINT_STATUS_LABELS = {
  [COMPLAINT_STATUS.NEW]: "New",
  [COMPLAINT_STATUS.ASSIGNED]: "Assigned",
  [COMPLAINT_STATUS.IN_PROGRESS]: "In Progress",
  [COMPLAINT_STATUS.RESOLVED]: "Resolved",
  [COMPLAINT_STATUS.CLOSED]: "Closed",
  [COMPLAINT_STATUS.ESCALATED]: "Escalated",
  [COMPLAINT_STATUS.REOPENED]: "Reopened",
};

/**
 * Status colors for UI
 */
const COMPLAINT_STATUS_COLORS = {
  [COMPLAINT_STATUS.NEW]: "#6B7280", // Gray
  [COMPLAINT_STATUS.ASSIGNED]: "#3B82F6", // Blue
  [COMPLAINT_STATUS.IN_PROGRESS]: "#F59E0B", // Amber
  [COMPLAINT_STATUS.RESOLVED]: "#10B981", // Green
  [COMPLAINT_STATUS.CLOSED]: "#6B7280", // Gray
  [COMPLAINT_STATUS.ESCALATED]: "#EF4444", // Red
  [COMPLAINT_STATUS.REOPENED]: "#8B5CF6", // Purple
};

/**
 * ================================
 * Priority Constants
 * ================================
 */

/**
 * Priority Levels
 */
const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * All priorities as array
 */
const PRIORITIES = Object.values(PRIORITY);

/**
 * Priority labels for display
 */
const PRIORITY_LABELS = {
  [PRIORITY.LOW]: "Low",
  [PRIORITY.MEDIUM]: "Medium",
  [PRIORITY.HIGH]: "High",
  [PRIORITY.CRITICAL]: "Critical",
};

/**
 * Priority colors for UI
 */
const PRIORITY_COLORS = {
  [PRIORITY.LOW]: "#10B981", // Green
  [PRIORITY.MEDIUM]: "#F59E0B", // Amber
  [PRIORITY.HIGH]: "#F97316", // Orange
  [PRIORITY.CRITICAL]: "#EF4444", // Red
};

/**
 * Priority order (for sorting)
 */
const PRIORITY_ORDER = {
  [PRIORITY.LOW]: 1,
  [PRIORITY.MEDIUM]: 2,
  [PRIORITY.HIGH]: 3,
  [PRIORITY.CRITICAL]: 4,
};

/**
 * Default SLA hours by priority
 */
const DEFAULT_SLA_HOURS = {
  [PRIORITY.LOW]: 72, // 3 days
  [PRIORITY.MEDIUM]: 48, // 2 days
  [PRIORITY.HIGH]: 24, // 1 day
  [PRIORITY.CRITICAL]: 4, // 4 hours
};

/**
 * ================================
 * User Role Constants
 * ================================
 */

/**
 * User Roles
 */
const ROLE = {
  USER: "user",
  STAFF: "staff",
  ADMIN: "admin",
};

/**
 * All roles as array
 */
const ROLES = Object.values(ROLE);

/**
 * Role labels for display
 */
const ROLE_LABELS = {
  [ROLE.USER]: "User",
  [ROLE.STAFF]: "Staff",
  [ROLE.ADMIN]: "Administrator",
};

/**
 * Role hierarchy (higher number = more privileges)
 */
const ROLE_HIERARCHY = {
  [ROLE.USER]: 1,
  [ROLE.STAFF]: 2,
  [ROLE.ADMIN]: 3,
};

/**
 * ================================
 * Notification Constants
 * ================================
 */

/**
 * Notification Types
 */
const NOTIFICATION_TYPE = {
  // Complaint lifecycle
  COMPLAINT_SUBMITTED: "complaint_submitted",
  COMPLAINT_ASSIGNED: "complaint_assigned",
  COMPLAINT_UPDATED: "complaint_updated",
  COMPLAINT_RESOLVED: "complaint_resolved",
  COMPLAINT_CLOSED: "complaint_closed",
  COMPLAINT_REOPENED: "complaint_reopened",

  // Escalation
  COMPLAINT_ESCALATED: "complaint_escalated",
  ESCALATION_WARNING: "escalation_warning",
  SLA_BREACH: "sla_breach",

  // Assignment
  NEW_ASSIGNMENT: "new_assignment",
  ASSIGNMENT_REMOVED: "assignment_removed",
  REASSIGNMENT: "reassignment",

  // Feedback
  FEEDBACK_RECEIVED: "feedback_received",
  FEEDBACK_REQUESTED: "feedback_requested",

  // Status
  STATUS_CHANGE: "status_change",
  PRIORITY_CHANGE: "priority_change",

  // System
  SYSTEM_ANNOUNCEMENT: "system_announcement",
  MAINTENANCE_NOTICE: "maintenance_notice",
  ACCOUNT_UPDATE: "account_update",

  // User actions
  MENTION: "mention",
  COMMENT_ADDED: "comment_added",
  ATTACHMENT_ADDED: "attachment_added",
};

/**
 * All notification types as array
 */
const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE);

/**
 * Notification priority levels
 */
const NOTIFICATION_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
};

/**
 * ================================
 * Feedback Constants
 * ================================
 */

/**
 * Feedback satisfaction levels
 */
const SATISFACTION_LEVEL = {
  VERY_DISSATISFIED: "very_dissatisfied",
  DISSATISFIED: "dissatisfied",
  NEUTRAL: "neutral",
  SATISFIED: "satisfied",
  VERY_SATISFIED: "very_satisfied",
};

/**
 * Satisfaction labels
 */
const SATISFACTION_LABELS = {
  [SATISFACTION_LEVEL.VERY_DISSATISFIED]: "Very Dissatisfied",
  [SATISFACTION_LEVEL.DISSATISFIED]: "Dissatisfied",
  [SATISFACTION_LEVEL.NEUTRAL]: "Neutral",
  [SATISFACTION_LEVEL.SATISFIED]: "Satisfied",
  [SATISFACTION_LEVEL.VERY_SATISFIED]: "Very Satisfied",
};

/**
 * Rating to satisfaction mapping
 */
const RATING_TO_SATISFACTION = {
  1: SATISFACTION_LEVEL.VERY_DISSATISFIED,
  2: SATISFACTION_LEVEL.DISSATISFIED,
  3: SATISFACTION_LEVEL.NEUTRAL,
  4: SATISFACTION_LEVEL.SATISFIED,
  5: SATISFACTION_LEVEL.VERY_SATISFIED,
};

/**
 * Positive aspects options
 */
const POSITIVE_ASPECTS = [
  "quick_response",
  "professional_handling",
  "effective_solution",
  "good_communication",
  "helpful_staff",
  "thorough_investigation",
  "kept_informed",
  "exceeded_expectations",
];

/**
 * Improvement areas options
 */
const IMPROVEMENT_AREAS = [
  "response_time",
  "communication",
  "solution_quality",
  "follow_up",
  "staff_attitude",
  "process_clarity",
  "resolution_time",
  "information_updates",
];

/**
 * ================================
 * Error Codes
 * ================================
 */

const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",

  // Authorization errors
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  INSUFFICIENT_PERMISSION: "INSUFFICIENT_PERMISSION",
  NOT_OWNER: "NOT_OWNER",
  NOT_ASSIGNED: "NOT_ASSIGNED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // File errors
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  TOO_MANY_FILES: "TOO_MANY_FILES",
  UPLOAD_ERROR: "UPLOAD_ERROR",

  // Business logic errors
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  COMPLAINT_ALREADY_RESOLVED: "COMPLAINT_ALREADY_RESOLVED",
  MAX_REOPENS_REACHED: "MAX_REOPENS_REACHED",
  REOPEN_WINDOW_EXPIRED: "REOPEN_WINDOW_EXPIRED",
  STAFF_AT_CAPACITY: "STAFF_AT_CAPACITY",
  FEEDBACK_ALREADY_SUBMITTED: "FEEDBACK_ALREADY_SUBMITTED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
};

/**
 * ================================
 * HTTP Status Codes
 * ================================
 */

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * ================================
 * Pagination Constants
 * ================================
 */

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
};

/**
 * ================================
 * File Upload Constants
 * ================================
 */

const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  MAX_ATTACHMENTS_PER_COMPLAINT: 10,
  MAX_EVIDENCE_FILES: 5,
  MAX_AVATAR_SIZE: 2 * 1024 * 1024, // 2MB

  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],

  IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  DOCUMENT_EXTENSIONS: [".pdf", ".doc", ".docx", ".txt"],
};

/**
 * ================================
 * Time Constants
 * ================================
 */

const TIME = {
  // Token expiry
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  PASSWORD_RESET_EXPIRY: 60 * 60 * 1000, // 1 hour
  EMAIL_VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours

  // Business rules
  REOPEN_WINDOW_DAYS: 7,
  MAX_REOPEN_COUNT: 3,
  WARNING_THRESHOLD_HOURS: 4,
  MAX_ESCALATION_LEVEL: 3,
  STALE_ESCALATION_HOURS: 24,

  // Rate limiting
  LOGIN_ATTEMPT_WINDOW: 15 * 60 * 1000, // 15 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_DURATION: 2 * 60 * 60 * 1000, // 2 hours

  // Caching
  CACHE_TTL_SHORT: 5 * 60, // 5 minutes
  CACHE_TTL_MEDIUM: 30 * 60, // 30 minutes
  CACHE_TTL_LONG: 24 * 60 * 60, // 24 hours
};

/**
 * ================================
 * Regex Patterns
 * ================================
 */

const REGEX = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
  PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  COMPLAINT_ID: /^CMP-\d{4}-\d{5}$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

/**
 * ================================
 * Default Values
 * ================================
 */

const DEFAULTS = {
  COMPLAINT_PRIORITY: PRIORITY.MEDIUM,
  USER_ROLE: ROLE.USER,
  STAFF_MAX_ASSIGNMENTS: 10,
  NOTIFICATION_PRIORITY: NOTIFICATION_PRIORITY.NORMAL,
  CATEGORY_COLOR: "#3B82F6",
  CATEGORY_ICON: "folder",
};

/**
 * ================================
 * Message Templates
 * ================================
 */

const MESSAGES = {
  // Success messages
  SUCCESS: {
    CREATED: "Created successfully",
    UPDATED: "Updated successfully",
    DELETED: "Deleted successfully",
    LOGIN: "Login successful",
    LOGOUT: "Logout successful",
    REGISTERED: "Registration successful",
    PASSWORD_CHANGED: "Password changed successfully",
    PASSWORD_RESET: "Password reset successful",
    EMAIL_VERIFIED: "Email verified successfully",
    COMPLAINT_SUBMITTED: "Complaint submitted successfully",
    COMPLAINT_ASSIGNED: "Complaint assigned successfully",
    COMPLAINT_RESOLVED: "Complaint resolved successfully",
    FEEDBACK_SUBMITTED: "Thank you for your feedback!",
  },

  // Error messages
  ERROR: {
    NOT_FOUND: "Resource not found",
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Access forbidden",
    INVALID_CREDENTIALS: "Invalid email or password",
    TOKEN_EXPIRED: "Your session has expired. Please login again.",
    ACCOUNT_LOCKED: "Account is locked due to too many failed attempts",
    ACCOUNT_DEACTIVATED: "Your account has been deactivated",
    VALIDATION_FAILED: "Validation failed",
    SERVER_ERROR: "Something went wrong. Please try again later.",
    RATE_LIMITED: "Too many requests. Please try again later.",
  },

  // Info messages
  INFO: {
    EMAIL_SENT:
      "If an account exists with this email, you will receive a reset link.",
    VERIFICATION_SENT: "Verification email sent",
    NO_CHANGES: "No changes made",
  },
};

/**
 * ================================
 * API Response Helpers
 * ================================
 */

/**
 * Create success response object
 */
const successResponse = (message, data = null) => ({
  success: true,
  message,
  ...(data && { data }),
});

/**
 * Create error response object
 */
const errorResponse = (message, code = null, errors = null) => ({
  success: false,
  message,
  ...(code && { code }),
  ...(errors && { errors }),
});

/**
 * ================================
 * Export All Constants
 * ================================
 */

module.exports = {
  // Complaint
  COMPLAINT_STATUS,
  COMPLAINT_STATUSES,
  ACTIVE_COMPLAINT_STATUSES,
  COMPLETED_COMPLAINT_STATUSES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,

  // Priority
  PRIORITY,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_ORDER,
  DEFAULT_SLA_HOURS,

  // Roles
  ROLE,
  ROLES,
  ROLE_LABELS,
  ROLE_HIERARCHY,

  // Notifications
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,

  // Feedback
  SATISFACTION_LEVEL,
  SATISFACTION_LABELS,
  RATING_TO_SATISFACTION,
  POSITIVE_ASPECTS,
  IMPROVEMENT_AREAS,

  // Error codes
  ERROR_CODES,
  HTTP_STATUS,

  // Configuration
  PAGINATION,
  FILE_UPLOAD,
  TIME,
  REGEX,
  DEFAULTS,

  // Messages
  MESSAGES,

  // Helpers
  successResponse,
  errorResponse,
};
