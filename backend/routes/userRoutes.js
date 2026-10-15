/**
 * User Routes
 *
 * Handles user-related endpoints:
 * - Profile management
 * - Notifications
 * - User preferences
 * - Admin user management
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
  getUserStats,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  getUserById,
  getAllUsers,
  updateUserById,
  deleteUser,
  deactivateAccount,
  addStaffFeedback,
} = require("../controllers/userController");

// Middleware
const { protect, attachUserStats } = require("../middleware/authMiddleware");
const {
  adminOnly,
  staffOrAdmin,
  selfOrAdmin,
} = require("../middleware/roleMiddleware");
const {
  userValidation,
  commonValidation,
} = require("../middleware/validateRequest");
const { uploadAvatar } = require("../middleware/uploadMiddleware");

/**
 * ================================
 * Profile Routes (All authenticated users)
 * ================================
 */

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", protect, getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put("/profile", protect, userValidation.updateProfile, updateProfile);

/**
 * @route   PUT /api/users/profile/avatar
 * @desc    Update profile avatar
 * @access  Private
 */
router.put("/profile/avatar", protect, uploadAvatar, updateAvatar);

/**
 * @route   DELETE /api/users/profile/avatar
 * @desc    Delete profile avatar
 * @access  Private
 */
router.delete("/profile/avatar", protect, deleteAvatar);

/**
 * @route   GET /api/users/stats
 * @desc    Get current user statistics
 * @access  Private
 */
router.get("/stats", protect, attachUserStats, getUserStats);

/**
 * @route   PUT /api/users/deactivate
 * @desc    Deactivate own account
 * @access  Private
 */
router.put(
  "/deactivate",
  protect,
  userValidation.deactivateAccount,
  deactivateAccount,
);

/**
 * ================================
 * Notification Routes
 * ================================
 */

/**
 * @route   GET /api/users/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get(
  "/notifications",
  protect,
  commonValidation.pagination,
  getNotifications,
);

/**
 * @route   PUT /api/users/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  "/notifications/:id/read",
  protect,
  commonValidation.objectIdParam("id"),
  markNotificationRead,
);

/**
 * @route   PUT /api/users/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/notifications/read-all", protect, markAllNotificationsRead);

/**
 * @route   DELETE /api/users/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete(
  "/notifications/:id",
  protect,
  commonValidation.objectIdParam("id"),
  deleteNotification,
);

/**
 * @route   GET /api/users/notification-preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get("/notification-preferences", protect, getNotificationPreferences);

/**
 * @route   PUT /api/users/notification-preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put(
  "/notification-preferences",
  protect,
  userValidation.updateNotificationPreferences,
  updateNotificationPreferences,
);

/**
 * ================================
 * Staff Feedback Routes
 * ================================
 */

/**
 * @route   POST /api/users/staff-feedback/:staffId
 * @desc    Add feedback for staff member (user feedback)
 * @access  Private/User
 */
router.post(
  "/staff-feedback/:staffId",
  protect,
  commonValidation.objectIdParam("staffId"),
  userValidation.addStaffFeedback,
  addStaffFeedback,
);

/**
 * ================================
 * Admin User Management Routes
 * ================================
 */

/**
 * @route   GET /api/users
 * @desc    Get all users (with pagination and filters)
 * @access  Private/Admin
 */
router.get("/", protect, adminOnly, commonValidation.pagination, getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private/Admin/Staff (Staff can only view regular users)
 */
router.get(
  "/:id",
  protect,
  staffOrAdmin,
  commonValidation.objectIdParam("id"),
  getUserById,
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @access  Private/Admin
 */
router.put(
  "/:id",
  protect,
  adminOnly,
  userValidation.updateUserById,
  updateUserById,
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  protect,
  adminOnly,
  commonValidation.objectIdParam("id"),
  deleteUser,
);

module.exports = router;
