/**
 * Admin Routes
 *
 * Handles all admin-specific endpoints:
 * - Dashboard and analytics
 * - Complaint management and assignment
 * - Staff management
 * - Escalation handling
 * - System configuration
 * - Reports and exports
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  getDashboardStats,
  getAllComplaints,
  getUnassignedComplaints,
  assignComplaint,
  reassignComplaint,
  bulkAssignComplaints,
  getEscalatedComplaints,
  escalateComplaint,
  getAllStaff,
  getAvailableStaff,
  getStaffPerformance,
  updateStaffStatus,
  updateStaffSpecializations,
  getStaffFeedback,
  addStaffFeedback,
  closeComplaint,
  getAnalytics,
  exportComplaints,
  createAnnouncement,
  getReports,
  exportReports,
  importUsersCsv,
  importComplaintsCsv,
  importCategoriesCsv,
  getAnalyticsTrends,
  getAnalyticsForecast,
  getAnalyticsComparison,
  getAnalyticsHeatmap,
  getAllUsers,
  createOrganization,
  getAllOrganizations,
} = require("../controllers/adminController");

const {
  getAdminNotifications,
  getUrgentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const {
  adminValidation,
  commonValidation,
} = require("../middleware/validateRequest");
const { responseCache } = require("../middleware/responseCache");

// Apply admin-only protection to all routes
router.use(protect);
router.use(adminOnly);

/**
 * ================================
 * Dashboard & Analytics Routes
 * ================================
 */

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard statistics
 * @access  Private/Admin
 */
router.get("/dashboard", responseCache(30), getDashboardStats);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get detailed analytics data
 * @access  Private/Admin
 */
router.get("/analytics", responseCache(60), getAnalytics);
router.get(
  "/analytics/trends",
  responseCache(60),
  adminValidation.analyticsQuery,
  getAnalyticsTrends,
);
router.get(
  "/analytics/forecast",
  responseCache(60),
  adminValidation.analyticsQuery,
  getAnalyticsForecast,
);
router.get(
  "/analytics/comparison",
  responseCache(60),
  adminValidation.analyticsQuery,
  getAnalyticsComparison,
);
router.get(
  "/analytics/heatmap",
  responseCache(60),
  adminValidation.analyticsQuery,
  getAnalyticsHeatmap,
);

/**
 * ================================
 * Complaint Management Routes
 * ================================
 */

/**
 * @route   GET /api/admin/complaints
 * @desc    Get all complaints with filters and pagination
 * @access  Private/Admin
 */
router.get(
  "/complaints",
  commonValidation.pagination,
  commonValidation.dateRange,
  getAllComplaints,
);

/**
 * @route   GET /api/admin/complaints/unassigned
 * @desc    Get all unassigned complaints
 * @access  Private/Admin
 */
router.get(
  "/complaints/unassigned",
  commonValidation.pagination,
  getUnassignedComplaints,
);

/**
 * @route   GET /api/admin/complaints/escalated
 * @desc    Get all escalated complaints
 * @access  Private/Admin
 */
router.get(
  "/complaints/escalated",
  commonValidation.pagination,
  getEscalatedComplaints,
);

/**
 * @route   POST /api/admin/complaints/:id/assign
 * @desc    Assign complaint to staff member
 * @access  Private/Admin
 */
router.post("/complaints/:id/assign", adminValidation.assign, assignComplaint);

/**
 * @route   PUT /api/admin/complaints/:id/reassign
 * @desc    Reassign complaint to different staff member
 * @access  Private/Admin
 */
router.put(
  "/complaints/:id/reassign",
  adminValidation.reassign,
  reassignComplaint,
);

/**
 * @route   POST /api/admin/complaints/bulk-assign
 * @desc    Bulk assign multiple complaints
 * @access  Private/Admin
 */
router.post(
  "/complaints/bulk-assign",
  adminValidation.bulkAssign,
  bulkAssignComplaints,
);

/**
 * @route   POST /api/admin/complaints/:id/escalate
 * @desc    Manually escalate a complaint
 * @access  Private/Admin
 */
router.post(
  "/complaints/:id/escalate",
  adminValidation.escalate,
  escalateComplaint,
);

/**
 * @route   PUT /api/admin/complaints/:id/close
 * @desc    Close a complaint
 * @access  Private/Admin
 */
router.put("/complaints/:id/close", adminValidation.close, closeComplaint);

/**
 * ================================
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all system users
 * @access  Private/Admin
 */
router.get("/users", commonValidation.pagination, getAllUsers);

/**
 * ================================
 * Staff Management Routes
 * ================================
 */

/**
 * @route   GET /api/admin/staff
 * @desc    Get all staff members with statistics
 * @access  Private/Admin
 */
router.get("/staff", commonValidation.pagination, getAllStaff);

/**
 * @route   GET /api/admin/staff/available
 * @desc    Get available staff for assignment
 * @access  Private/Admin
 */
router.get("/staff/available", getAvailableStaff);

/**
 * @route   GET /api/admin/staff/:id/performance
 * @desc    Get detailed staff performance report
 * @access  Private/Admin
 */
router.get(
  "/staff/:id/performance",
  commonValidation.objectIdParam("id"),
  commonValidation.dateRange,
  getStaffPerformance,
);

/**
 * @route   PUT /api/admin/staff/:id/status
 * @desc    Update staff active status (activate/deactivate)
 * @access  Private/Admin
 */
router.put(
  "/staff/:id/status",
  adminValidation.updateStaffStatus,
  updateStaffStatus,
);

/**
 * @route   PUT /api/admin/staff/:id/specializations
 * @desc    Update staff specializations and capacity
 * @access  Private/Admin
 */
router.put(
  "/staff/:id/specializations",
  adminValidation.updateStaffSpecializations,
  updateStaffSpecializations,
);

/**
 * @route   GET /api/admin/staff/:id/feedback
 * @desc    Get all feedback for a staff member
 * @access  Private/Admin
 */
router.get(
  "/staff/:id/feedback",
  commonValidation.objectIdParam("id"),
  getStaffFeedback,
);

/**
 * @route   POST /api/admin/staff/:id/feedback
 * @desc    Add feedback for a staff member
 * @access  Private/Admin
 */
router.post(
  "/staff/:id/feedback",
  commonValidation.objectIdParam("id"),
  adminValidation.addFeedback,
  addStaffFeedback,
);

/**
 * ================================
 * Export & Report Routes
 * ================================
 */

/**
 * @route   GET /api/admin/export/complaints
 * @desc    Export complaints data (CSV/JSON)
 * @access  Private/Admin
 */
router.get("/export/complaints", commonValidation.dateRange, exportComplaints);

/**
 * @route   POST /api/admin/import/users
 * @desc    Bulk import users from CSV text or rows array
 * @access  Private/Admin
 */
router.post("/import/users", adminValidation.importPayload, importUsersCsv);

/**
 * @route   POST /api/admin/import/complaints
 * @desc    Bulk import complaints from CSV text or rows array
 * @access  Private/Admin
 */
router.post(
  "/import/complaints",
  adminValidation.importPayload,
  importComplaintsCsv,
);

/**
 * @route   POST /api/admin/import/categories
 * @desc    Bulk import categories from CSV text or rows array
 * @access  Private/Admin
 */
router.post(
  "/import/categories",
  adminValidation.importPayload,
  importCategoriesCsv,
);

/**
 * ================================
 * Notification Routes
 * ================================
 */

/**
 * @route   GET /api/admin/notifications
 * @desc    Get all notifications
 * @access  Private/Admin
 */
router.get("/notifications", getAdminNotifications);

/**
 * @route   GET /api/admin/notifications/urgent
 * @desc    Get urgent notifications
 * @access  Private/Admin
 */
router.get("/notifications/urgent", getUrgentNotifications);

/**
 * @route   PATCH /api/admin/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private/Admin
 */
router.patch(
  "/notifications/:id/read",
  commonValidation.objectIdParam("id"),
  markNotificationRead,
);

/**
 * @route   PATCH /api/admin/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private/Admin
 */
router.patch("/notifications/mark-all-read", markAllNotificationsRead);

/**
 * ================================
 * System Management Routes
 * ================================
 */

/**
 * @route   GET /api/admin/organizations
 * @desc    Get all organizations
 * @access  Private/SuperAdmin
 */
router.get("/organizations", commonValidation.pagination, getAllOrganizations);

/**
 * @route   POST /api/admin/organizations
 * @desc    Create new organization
 * @access  Private/SuperAdmin
 */
router.post(
  "/organizations",
  adminValidation.createOrganization,
  createOrganization,
);

/**
 * @route   POST /api/admin/announcements
 * @desc    Create system announcement
 * @access  Private/Admin
 */
router.post(
  "/announcements",
  adminValidation.createAnnouncement,
  createAnnouncement,
);

/**
 * @route   GET /api/admin/system/health
 * @desc    Get system health status
 * @access  Private/Admin
 */
router.get("/system/health", async (req, res) => {
  try {
    const mongoose = require("mongoose");

    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    // Get basic stats
    const User = require("../models/User");
    const Complaint = require("../models/Complaint");

    const [userCount, complaintCount, activeComplaintCount] = await Promise.all(
      [
        User.countDocuments(),
        Complaint.countDocuments(),
        Complaint.countDocuments({ status: { $nin: ["resolved", "closed"] } }),
      ],
    );

    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: dbStatus[dbState],
          connected: dbState === 1,
        },
        stats: {
          totalUsers: userCount,
          totalComplaints: complaintCount,
          activeComplaints: activeComplaintCount,
        },
        memory: {
          used:
            Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
          total:
            Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
        },
        environment: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        status: "unhealthy",
        error: error.message,
      },
    });
  }
});

/**
 * @route   GET /api/admin/system/logs
 * @desc    Get recent system logs (placeholder for log management)
 * @access  Private/Admin
 */
router.get("/system/logs", (req, res) => {
  // This would typically connect to a logging service
  res.status(200).json({
    success: true,
    message: "Log management endpoint - integrate with logging service",
    data: {
      logs: [],
    },
  });
});

/**
 * @route   GET /api/admin/system/performance
 * @desc    Get process-level performance metrics
 * @access  Private/Admin
 */
router.get("/system/performance", responseCache(15), async (req, res) => {
  try {
    const { monitorEventLoopDelay } = require("perf_hooks");
    const mongoose = require("mongoose");

    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    await new Promise((resolve) => setTimeout(resolve, 60));
    histogram.disable();

    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const cpuUsage = process.cpuUsage();
    const memory = process.memoryUsage();

    return res.status(200).json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptimeSeconds: process.uptime(),
        cpu: {
          userMicros: cpuUsage.user,
          systemMicros: cpuUsage.system,
        },
        memory: {
          rssMB: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          heapUsedMB: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMB: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
          externalMB: Math.round((memory.external / 1024 / 1024) * 100) / 100,
        },
        eventLoop: {
          minMs: Number((histogram.min / 1e6).toFixed(3)),
          maxMs: Number((histogram.max / 1e6).toFixed(3)),
          meanMs: Number((histogram.mean / 1e6).toFixed(3)),
          p95Ms: Number((histogram.percentile(95) / 1e6).toFixed(3)),
        },
        database: {
          status: dbStatus[dbState],
          connected: dbState === 1,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch performance metrics",
    });
  }
});

/**
 * @route   POST /api/admin/system/maintenance
 * @desc    Toggle maintenance mode
 * @access  Private/Admin
 */
router.post("/system/maintenance", (req, res) => {
  const { enabled, message } = req.body;

  // In production, this would set a flag in Redis or database
  // For now, we'll just acknowledge the request

  res.status(200).json({
    success: true,
    message: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
    data: {
      maintenanceMode: enabled,
      maintenanceMessage: message || "System is under maintenance",
    },
  });
});

/**
 * @swagger
 * /api/admin/audit-log:
 *   get:
 *     summary: Get audit log entries
 *     description: Returns paginated audit log entries with optional filters.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: actorRole
 *         schema:
 *           type: string
 *         description: Filter by actor role
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action text (regex match)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter entries created at or after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter entries created at or before this date
 *     responses:
 *       200:
 *         description: Audit logs fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Failed to fetch audit logs
 */

/**
 * @route   GET /api/admin/audit-log
 * @desc    Get audit log entries
 * @access  Private/Admin
 */
router.get(
  "/audit-log",
  commonValidation.pagination,
  commonValidation.dateRange,
  async (req, res) => {
    try {
      const AuditLog = require("../models/AuditLog");

      const page = Math.max(parseInt(req.query.page || 1, 10), 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit || 20, 10), 1),
        100,
      );
      const skip = (page - 1) * limit;

      const query = {};
      if (req.user.role !== "super_admin") {
        query.organization = req.user.organization;
      }

      if (req.query.startDate || req.query.endDate) {
        query.createdAt = {};
        if (req.query.startDate)
          query.createdAt.$gte = new Date(req.query.startDate);
        if (req.query.endDate)
          query.createdAt.$lte = new Date(req.query.endDate);
      }

      if (req.query.actorRole) {
        query.actorRole = req.query.actorRole;
      }

      if (req.query.action) {
        query.action = { $regex: req.query.action, $options: "i" };
      }

      const [entries, totalItems] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("actorId", "name email role")
          .populate("organization", "name code"),
        AuditLog.countDocuments(query),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          entries,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            limit,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch audit logs",
      });
    }
  },
);

/**
 * ================================
 * Advanced Reporting Routes
 * ================================
 */

/**
 * @route   GET /api/admin/reports
 * @desc    Get comprehensive reports with analytics
 * @access  Private/Admin
 */
router.get(
  "/reports",
  responseCache(120),
  commonValidation.dateRange,
  adminValidation.reportsQuery,
  getReports,
);

/**
 * @route   GET /api/admin/reports/export
 * @desc    Export reports in PDF/Excel format
 * @access  Private/Admin
 */
router.get(
  "/reports/export",
  responseCache(120),
  commonValidation.dateRange,
  adminValidation.reportsQuery,
  exportReports,
);

/**
 * ================================
 * Escalation Rules Routes
 * ================================
 */
const {
  getEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  toggleEscalationRule,
  processEscalations,
} = require("../controllers/escalationRulesController");

/**
 * @route   GET /api/admin/escalation-rules
 * @desc    Get all escalation rules
 * @access  Private/Admin
 */
router.get("/escalation-rules", getEscalationRules);

/**
 * @route   POST /api/admin/escalation-rules
 * @desc    Create new escalation rule
 * @access  Private/Admin
 */
router.post("/escalation-rules", createEscalationRule);

/**
 * @route   PUT /api/admin/escalation-rules/:id
 * @desc    Update escalation rule
 * @access  Private/Admin
 */
router.put("/escalation-rules/:id", updateEscalationRule);

/**
 * @route   DELETE /api/admin/escalation-rules/:id
 * @desc    Delete escalation rule
 * @access  Private/Admin
 */
router.delete("/escalation-rules/:id", deleteEscalationRule);

/**
 * @route   PATCH /api/admin/escalation-rules/:id/toggle
 * @desc    Toggle escalation rule status
 * @access  Private/Admin
 */
router.patch("/escalation-rules/:id/toggle", toggleEscalationRule);

/**
 * @route   POST /api/admin/escalation-rules/process
 * @desc    Manually process escalations
 * @access  Private/Admin
 */
router.post("/escalation-rules/process", processEscalations);

module.exports = router;
