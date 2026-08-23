/**
 * Role-Based Access Control Middleware
 *
 * Handles authorization based on user roles:
 * - Role verification
 * - Permission checking
 * - Resource access control
 */

/**
 * Role hierarchy and permissions
 */
const ROLES = {
  user: {
    level: 1,
    permissions: [
      "complaint:create",
      "complaint:read:own",
      "complaint:update:own",
      "complaint:cancel:own",
      "complaint:reopen:own",
      "feedback:create",
      "feedback:read:own",
      "profile:read:own",
      "profile:update:own",
      "notification:read:own",
      "notification:update:own",
    ],
  },
  staff: {
    level: 2,
    permissions: [
      // Inherits user permissions
      "complaint:read:assigned",
      "complaint:update:assigned",
      "complaint:resolve:assigned",
      "complaint:add-notes:assigned",
      "complaint:add-evidence:assigned",
      "feedback:read:received",
      "user:read:basic",
    ],
  },
  org_admin: {
    level: 3,
    permissions: [
      // Full access within organization
      "complaint:read:org",
      "complaint:update:org",
      "complaint:assign",
      "complaint:reassign",
      "complaint:escalate",
      "complaint:close:org",
      "complaint:delete:org",
      "user:read:org",
      "user:create:org",
      "user:update:org",
      "user:delete:org",
      "staff:manage",
      "category:manage",
      "feedback:read:org",
      "feedback:respond",
      "analytics:view:org",
      "system:configure:org",
      "announcement:create:org",
    ],
  },
  super_admin: {
    level: 4,
    permissions: [
      // Full system access
      "org:create",
      "org:read:all",
      "org:update:all",
      "org:delete:all",
      "user:read:all",
      "user:manage:all",
      "system:configure:all",
    ],
  },
  // Alias for backward compatibility
  admin: {
    level: 3,
    permissions: [
      "complaint:read:org",
      // ... duplicates of org_admin permissions effectively
      // But usually we just want the levels to work
    ],
  },
};

// Copy org_admin permissions to admin for safety
ROLES.admin.permissions = ROLES.org_admin.permissions;

/**
 * Check if role has specific permission
 *
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
  if (!ROLES[role]) {
    return false;
  }

  // Super Admin has all permissions globally
  if (role === "super_admin") {
    return true;
  }

  // Org Admin has all permissions within organization (handled by controller logic usually, but here we just check role capability)
  if (role === "org_admin" && !permission.endsWith(":all")) {
    // Deny global permissions usually suffix with :all
    return true;
  }

  // For compatibility with old code relying on 'admin'
  if (role === "admin") {
    // Allow if it maps to org_admin capability
    return true;
  }

  // Check direct permission
  if (ROLES[role].permissions.includes(permission)) {
    return true;
  }

  // Staff inherits user permissions
  if (role === "staff" && ROLES.user.permissions.includes(permission)) {
    return true;
  }

  return false;
};

/**
 * Check if role level is sufficient
 *
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean}
 */
const hasRoleLevel = (userRole, requiredRole) => {
  if (!ROLES[userRole] || !ROLES[requiredRole]) {
    return false;
  }

  return ROLES[userRole].level >= ROLES[requiredRole].level;
};

/**
 * Restrict route to specific roles
 *
 * @param  {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Middleware function
 *
 * @example
 * router.get('/admin/users', protect, restrictTo('admin'), getUsers);
 * router.get('/staff/complaints', protect, restrictTo('staff', 'admin'), getComplaints);
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to access this resource.",
        code: "AUTH_REQUIRED",
      });
    }

    // Super Admin has access to everything
    if (req.user.role === "super_admin") {
      return next();
    }

    // Map 'admin' requirements to 'org_admin' role
    // If route requires 'admin', and user is 'org_admin', that's valid.
    if (allowedRoles.includes("admin") && req.user.role === "org_admin") {
      return next();
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This resource requires one of the following roles: ${allowedRoles.join(", ")}.`,
        code: "INSUFFICIENT_ROLE",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Require minimum role level
 * Allows the specified role and any higher roles
 *
 * @param {string} minRole - Minimum required role
 * @returns {Function} Middleware function
 *
 * @example
 * router.get('/data', protect, requireMinRole('staff'), getData);
 * // Allows staff and admin
 */
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    if (!hasRoleLevel(req.user.role, minRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Minimum role required: ${minRole}.`,
        code: "INSUFFICIENT_ROLE_LEVEL",
        requiredMinRole: minRole,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Check specific permission
 *
 * @param {string} permission - Permission to check
 * @returns {Function} Middleware function
 *
 * @example
 * router.post('/assign', protect, requirePermission('complaint:assign'), assignComplaint);
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}.`,
        code: "INSUFFICIENT_PERMISSION",
        requiredPermission: permission,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Check multiple permissions (ALL required)
 *
 * @param {...string} permissions - Permissions to check
 * @returns {Function} Middleware function
 */
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    const missingPermissions = permissions.filter(
      (perm) => !hasPermission(req.user.role, perm),
    );

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Missing required permissions.",
        code: "INSUFFICIENT_PERMISSIONS",
        missingPermissions,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Check multiple permissions (ANY required)
 *
 * @param {...string} permissions - Permissions to check
 * @returns {Function} Middleware function
 */
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    const hasAny = permissions.some((perm) =>
      hasPermission(req.user.role, perm),
    );

    if (!hasAny) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Requires at least one of the following permissions.",
        code: "INSUFFICIENT_PERMISSIONS",
        requiredPermissions: permissions,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Admin only shorthand
 */
const adminOnly = restrictTo("admin", "org_admin", "super_admin");

/**
 * Staff or admin shorthand
 */
const staffOrAdmin = restrictTo("staff", "admin", "org_admin", "super_admin");

/**
 * Authenticated user (any role) shorthand
 */
const authenticated = restrictTo(
  "user",
  "staff",
  "admin",
  "org_admin",
  "super_admin",
);

/**
 * Check ownership or specific roles
 * Useful for resources that owners and admins can access
 *
 * @param {Function} getResourceOwnerId - Async function to get owner ID
 * @param {...string} additionalRoles - Additional roles that can access
 * @returns {Function} Middleware function
 */
const ownerOrRoles = (getResourceOwnerId, ...additionalRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
          code: "AUTH_REQUIRED",
        });
      }

      // Check if user has one of the additional roles
      if (additionalRoles.includes(req.user.role)) {
        return next();
      }

      // Check ownership
      const ownerId = await getResourceOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Resource not found.",
        });
      }

      if (ownerId.toString() === req.user.id) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message:
          "Access denied. You do not have permission to access this resource.",
        code: "ACCESS_DENIED",
      });
    } catch (error) {
      console.error("Owner or roles check error:", error);
      return res.status(500).json({
        success: false,
        message: "Error checking access permissions.",
      });
    }
  };
};

/**
 * Check if user is assigned to complaint or is admin
 * Specific for complaint-related routes
 */
const assigneeOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    // Admin has full access
    if (
      req.user.role === "admin" ||
      req.user.role === "org_admin" ||
      req.user.role === "super_admin"
    ) {
      return next();
    }

    // For staff, check if they're assigned
    if (req.user.role === "staff") {
      const Complaint = require("../models/Complaint");
      const complaintId = req.params.id || req.params.complaintId;

      const complaint =
        await Complaint.findById(complaintId).select("assignedTo");

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found.",
        });
      }

      if (complaint.assignedTo?.toString() === req.user.id) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you.",
        code: "NOT_ASSIGNED",
      });
    }

    return res.status(403).json({
      success: false,
      message: "Access denied.",
      code: "ACCESS_DENIED",
    });
  } catch (error) {
    console.error("Assignee or admin check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking access permissions.",
    });
  }
};

/**
 * Check if user is complaint owner, assignee, or admin
 * For viewing complaint details
 */
const complaintAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    // Admin has full access
    if (
      req.user.role === "admin" ||
      req.user.role === "org_admin" ||
      req.user.role === "super_admin"
    ) {
      return next();
    }

    const Complaint = require("../models/Complaint");
    const complaintId = req.params.id || req.params.complaintId;

    const complaint =
      await Complaint.findById(complaintId).select("user assignedTo");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    // Check if owner
    if (complaint.user.toString() === req.user.id) {
      req.isComplaintOwner = true;
      return next();
    }

    // Check if assignee (for staff)
    if (
      req.user.role === "staff" &&
      complaint.assignedTo?.toString() === req.user.id
    ) {
      req.isComplaintAssignee = true;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have access to this complaint.",
      code: "ACCESS_DENIED",
    });
  } catch (error) {
    console.error("Complaint access check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking access permissions.",
    });
  }
};

/**
 * Department-based access control
 * Restricts access based on user's department
 *
 * @param {...string} allowedDepartments - Departments that can access
 * @returns {Function} Middleware function
 */
const restrictToDepartment = (...allowedDepartments) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    // Admin bypasses department restrictions
    if (
      req.user.role === "admin" ||
      req.user.role === "org_admin" ||
      req.user.role === "super_admin"
    ) {
      return next();
    }

    if (!req.user.department) {
      return res.status(403).json({
        success: false,
        message: "Department assignment required for this resource.",
        code: "NO_DEPARTMENT",
      });
    }

    if (!allowedDepartments.includes(req.user.department)) {
      return res.status(403).json({
        success: false,
        message: "Your department does not have access to this resource.",
        code: "DEPARTMENT_RESTRICTED",
        allowedDepartments,
        userDepartment: req.user.department,
      });
    }

    next();
  };
};

/**
 * Self or admin access
 * Allows users to access their own resources or admins to access any
 */
const selfOrAdmin = (userIdParam = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    const targetUserId = req.params[userIdParam];

    // Admin can access any user
    if (
      req.user.role === "admin" ||
      req.user.role === "org_admin" ||
      req.user.role === "super_admin"
    ) {
      return next();
    }

    // Users can only access their own resources
    if (targetUserId === req.user.id || targetUserId === "me") {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You can only access your own resources.",
      code: "SELF_ACCESS_ONLY",
    });
  };
};

/**
 * Get user permissions for response
 * Utility function to include permissions in API response
 */
const getUserPermissions = (role) => {
  if (!ROLES[role]) {
    return [];
  }

  if (role === "admin" || role === "super_admin" || role === "org_admin") {
    // Return all specific permissions for admin
    return Object.values(ROLES).flatMap((r) => r.permissions);
  }

  const permissions = [...ROLES[role].permissions];

  // Staff inherits user permissions
  if (role === "staff") {
    permissions.push(...ROLES.user.permissions);
  }

  return [...new Set(permissions)]; // Remove duplicates
};

module.exports = {
  // Role constants
  ROLES,

  // Utility functions
  hasPermission,
  hasRoleLevel,
  getUserPermissions,

  // Middleware functions
  restrictTo,
  requireMinRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,

  // Shorthand middleware
  adminOnly,
  staffOrAdmin,
  authenticated,

  // Resource-specific middleware
  ownerOrRoles,
  assigneeOrAdmin,
  complaintAccess,
  restrictToDepartment,
  selfOrAdmin,
};
