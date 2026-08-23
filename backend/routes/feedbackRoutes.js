/**
 * Feedback Routes
 *
 * Handles all feedback-related endpoints:
 * - Submit feedback for resolved complaints
 * - View feedback history
 * - Admin feedback management
 * - Feedback analytics
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  submitFeedback,
  getFeedbackByComplaint,
  getMyFeedback,
  getAllFeedback,
  getFeedbackStats,
  getStaffFeedback,
  respondToFeedback,
  flagFeedback,
  updateReviewStatus,
  getPendingFeedbackRequests,
  checkFeedbackExists,
  getFeedbackTrends,
  deleteFeedback,
} = require("../controllers/feedbackController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const {
  restrictTo,
  adminOnly,
  staffOrAdmin,
} = require("../middleware/roleMiddleware");
const {
  feedbackValidation,
  commonValidation,
} = require("../middleware/validateRequest");

// All routes require authentication
router.use(protect);

/**
 * ================================
 * User Feedback Routes
 * ================================
 */

/**
 * @route   POST /api/feedback
 * @desc    Submit feedback for a resolved complaint
 * @access  Private/User
 */
router.post("/", restrictTo("user"), feedbackValidation.submit, submitFeedback);

/**
 * @route   GET /api/feedback/my-feedback
 * @desc    Get current user's feedback history
 * @access  Private/User
 */
router.get(
  "/my-feedback",
  restrictTo("user"),
  commonValidation.pagination,
  getMyFeedback,
);

/**
 * @route   GET /api/feedback/pending-requests
 * @desc    Get complaints awaiting feedback
 * @access  Private/User
 */
router.get("/pending-requests", restrictTo("user"), getPendingFeedbackRequests);

/**
 * @route   GET /api/feedback/check/:complaintId
 * @desc    Check if feedback exists for a complaint
 * @access  Private
 */
router.get(
  "/check/:complaintId",
  commonValidation.objectIdParam("complaintId"),
  checkFeedbackExists,
);

/**
 * @route   GET /api/feedback/complaint/:complaintId
 * @desc    Get feedback for a specific complaint
 * @access  Private (Owner, Assigned Staff, or Admin)
 */
router.get(
  "/complaint/:complaintId",
  commonValidation.objectIdParam("complaintId"),
  getFeedbackByComplaint,
);

/**
 * ================================
 * Staff Feedback Routes
 * ================================
 */

/**
 * @route   GET /api/feedback/staff/my-feedback
 * @desc    Get feedback received by current staff member
 * @access  Private/Staff
 */
router.get(
  "/staff/my-feedback",
  restrictTo("staff"),
  commonValidation.pagination,
  getStaffFeedback,
);

/**
 * ================================
 * Admin Feedback Routes
 * ================================
 */

/**
 * @route   GET /api/feedback
 * @desc    Get all feedback (with filters)
 * @access  Private/Admin
 */
router.get(
  "/",
  adminOnly,
  commonValidation.pagination,
  commonValidation.dateRange,
  getAllFeedback,
);

/**
 * @route   GET /api/feedback/stats
 * @desc    Get feedback statistics
 * @access  Private/Admin
 */
router.get("/stats", adminOnly, commonValidation.dateRange, getFeedbackStats);

/**
 * @route   GET /api/feedback/trends
 * @desc    Get feedback trends over time
 * @access  Private/Admin
 */
router.get("/trends", adminOnly, getFeedbackTrends);

/**
 * @route   POST /api/feedback/:id/respond
 * @desc    Add admin response to feedback
 * @access  Private/Admin
 */
router.post(
  "/:id/respond",
  adminOnly,
  feedbackValidation.respond,
  respondToFeedback,
);

/**
 * @route   PUT /api/feedback/:id/flag
 * @desc    Flag feedback for review
 * @access  Private/Admin
 */
router.put("/:id/flag", adminOnly, feedbackValidation.flag, flagFeedback);

/**
 * @route   PUT /api/feedback/:id/review
 * @desc    Update feedback review status
 * @access  Private/Admin
 */
router.put(
  "/:id/review",
  adminOnly,
  commonValidation.objectIdParam("id"),
  updateReviewStatus,
);

/**
 * @route   DELETE /api/feedback/:id
 * @desc    Delete feedback (admin only, special cases)
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  adminOnly,
  commonValidation.objectIdParam("id"),
  deleteFeedback,
);

module.exports = router;
