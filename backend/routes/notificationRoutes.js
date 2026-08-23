/**
 * Notification Routes for Admin
 * 
 * Handles notification-related endpoints for admins:
 * - Real-time notifications
 * - Mark as read/unread
 * - Notification history
 */

const express = require("express");
const router = express.Router();
const {
  getAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUrgentNotifications,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

// Apply admin-only protection
router.use(protect);
router.use(adminOnly);

/**
 * @route   GET /api/admin/notifications
 * @desc    Get all notifications for admin
 * @access  Private/Admin
 */
router.get("/", getAdminNotifications);

/**
 * @route   GET /api/admin/notifications/urgent
 * @desc    Get urgent notifications only
 * @access  Private/Admin
 */
router.get("/urgent", getUrgentNotifications);

/**
 * @route   PATCH /api/admin/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private/Admin
 */
router.patch("/:id/read", markNotificationRead);

/**
 * @route   PATCH /api/admin/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private/Admin
 */
router.patch("/mark-all-read", markAllNotificationsRead);

module.exports = router;