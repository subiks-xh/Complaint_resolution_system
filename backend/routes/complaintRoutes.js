/**
 * Complaint Routes
 *
 * Handles all complaint-related endpoints for regular users:
 * - Create and manage complaints
 * - View complaint details and history
 * - Manage attachments
 * - Cancel and reopen complaints
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  updateComplaint,
  addAttachment,
  deleteAttachment,
  cancelComplaint,
  reopenComplaint,
  getMyComplaintStats,
  searchComplaints,
  getComplaintTimeline,
} = require("../controllers/complaintController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const { complaintAccess } = require("../middleware/roleMiddleware");
const {
  complaintValidation,
  commonValidation,
} = require("../middleware/validateRequest");
const {
  uploadComplaintAttachments,
  cleanupOnError,
  optionalUpload,
} = require("../middleware/uploadMiddleware");

/**
 * ================================
 * User Complaint Management Routes
 * ================================
 */

/**
 * @route   POST /api/complaints
 * @desc    Create a new complaint
 * @access  Private/User
 */
router.post(
  "/",
  protect,
  uploadComplaintAttachments,
  cleanupOnError,
  complaintValidation.create,
  createComplaint,
);

/**
 * @route   GET /api/complaints/my-complaints
 * @desc    Get all complaints for current user
 * @access  Private/User
 */
router.get(
  "/my-complaints",
  protect,
  complaintValidation.list,
  getMyComplaints,
);

/**
 * @route   GET /api/complaints/my-stats
 * @desc    Get complaint statistics for current user
 * @access  Private/User
 */
router.get("/my-stats", protect, getMyComplaintStats);

/**
 * @route   GET /api/complaints/search
 * @desc    Search complaints
 * @access  Private
 */
router.get("/search", protect, commonValidation.search, searchComplaints);

/**
 * @route   GET /api/complaints/:id
 * @desc    Get complaint by ID
 * @access  Private (Owner, Assigned Staff, or Admin)
 */
router.get("/:id", protect, complaintValidation.getById, getComplaintById);

/**
 * @route   PUT /api/complaints/:id
 * @desc    Update complaint (only if status is 'new')
 * @access  Private/User (Owner only)
 */
router.put("/:id", protect, complaintValidation.update, updateComplaint);

/**
 * @route   GET /api/complaints/:id/timeline
 * @desc    Get complaint timeline/history
 * @access  Private (Owner, Assigned Staff, or Admin)
 */
router.get(
  "/:id/timeline",
  protect,
  complaintValidation.getById,
  getComplaintTimeline,
);

/**
 * ================================
 * Attachment Routes
 * ================================
 */

/**
 * @route   POST /api/complaints/:id/attachments
 * @desc    Add attachments to complaint
 * @access  Private (Owner, Assigned Staff, or Admin)
 */
router.post(
  "/:id/attachments",
  protect,
  complaintAccess,
  uploadComplaintAttachments,
  cleanupOnError,
  addAttachment,
);

/**
 * @route   DELETE /api/complaints/:id/attachments/:attachmentId
 * @desc    Delete attachment from complaint
 * @access  Private (Owner or Admin)
 */
router.delete(
  "/:id/attachments/:attachmentId",
  protect,
  complaintValidation.deleteAttachment,
  deleteAttachment,
);

/**
 * ================================
 * Complaint Status Routes
 * ================================
 */

/**
 * @route   PUT /api/complaints/:id/cancel
 * @desc    Cancel/withdraw complaint
 * @access  Private/User (Owner only)
 */
router.put("/:id/cancel", protect, complaintValidation.cancel, cancelComplaint);

/**
 * @route   PUT /api/complaints/:id/reopen
 * @desc    Reopen a resolved complaint
 * @access  Private/User (Owner only)
 */
router.put("/:id/reopen", protect, complaintValidation.reopen, reopenComplaint);

module.exports = router;
