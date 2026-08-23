/**
 * Staff Routes
 *
 * Handles all staff-specific endpoints:
 * - Dashboard and workload management
 * - Assigned complaints management
 * - Status updates and resolution
 * - Internal notes and evidence
 * - Performance tracking
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  getDashboard,
  getAssignedComplaints,
  getComplaintDetails,
  updateComplaintStatus,
  requestComplaintPayment,
  acknowledgeComplaintPayment,
  startWorkingOnComplaint,
  startWorkSession,
  pauseWorkSession,
  addInternalNote,
  deleteInternalNote,
  addResolutionEvidence,
  deleteResolutionEvidence,
  resolveComplaint,
  requestReassignment,
  getMyPerformance,
  getMyFeedback,
  getAvailableStaffForSuggestion,
  getWorkload,
} = require("../controllers/staffController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const { restrictTo, assigneeOrAdmin } = require("../middleware/roleMiddleware");
const {
  staffValidation,
  commonValidation,
} = require("../middleware/validateRequest");
const {
  uploadResolutionEvidence,
  cleanupOnError,
  optionalUpload,
} = require("../middleware/uploadMiddleware");

// Apply staff-only protection to all routes
router.use(protect);
router.use(restrictTo("staff", "admin"));

/**
 * ================================
 * Dashboard & Overview Routes
 * ================================
 */

/**
 * @route   GET /api/staff/dashboard
 * @desc    Get staff dashboard data
 * @access  Private/Staff
 */
router.get("/dashboard", getDashboard);

/**
 * @route   GET /api/staff/workload
 * @desc    Get current workload summary
 * @access  Private/Staff
 */
router.get("/workload", getWorkload);

/**
 * @route   GET /api/staff/performance
 * @desc    Get performance statistics
 * @access  Private/Staff
 */
router.get("/performance", getMyPerformance);

/**
 * @route   GET /api/staff/feedback
 * @desc    Get feedback received on resolved complaints
 * @access  Private/Staff
 */
router.get("/feedback", commonValidation.pagination, getMyFeedback);

/**
 * @route   GET /api/staff/available-staff
 * @desc    Get available staff for reassignment suggestion
 * @access  Private/Staff
 */
router.get("/available-staff", getAvailableStaffForSuggestion);

/**
 * ================================
 * Complaint Management Routes
 * ================================
 */

/**
 * @route   GET /api/staff/complaints
 * @desc    Get all complaints assigned to staff
 * @access  Private/Staff
 */
router.get("/complaints", commonValidation.pagination, getAssignedComplaints);

/**
 * @route   GET /api/staff/complaints/:id
 * @desc    Get single complaint details
 * @access  Private/Staff (Assigned only)
 */
router.get(
  "/complaints/:id",
  commonValidation.objectIdParam("id"),
  getComplaintDetails,
);

/**
 * ================================
 * Status Update Routes
 * ================================
 */

/**
 * @route   PUT /api/staff/complaints/:id/status
 * @desc    Update complaint status
 * @access  Private/Staff (Assigned only)
 */
router.put(
  "/complaints/:id/status",
  staffValidation.updateStatus,
  updateComplaintStatus,
);

router.post(
  "/complaints/:id/request-payment",
  commonValidation.objectIdParam("id"),
  requestComplaintPayment,
);

router.post(
  "/complaints/:id/acknowledge-payment",
  commonValidation.objectIdParam("id"),
  acknowledgeComplaintPayment,
);

/**
 * @route   PUT /api/staff/complaints/:id/start
 * @desc    Start working on complaint (quick action)
 * @access  Private/Staff (Assigned only)
 */
router.put(
  "/complaints/:id/start",
  commonValidation.objectIdParam("id"),
  startWorkingOnComplaint,
);

router.post(
  "/complaints/:id/work-session/start",
  commonValidation.objectIdParam("id"),
  startWorkSession,
);

router.post(
  "/complaints/:id/work-session/pause",
  commonValidation.objectIdParam("id"),
  pauseWorkSession,
);

/**
 * @route   POST /api/staff/complaints/:id/resolve
 * @desc    Resolve complaint with remarks and optional evidence
 * @access  Private/Staff (Assigned only)
 */
router.post(
  "/complaints/:id/resolve",
  optionalUpload(uploadResolutionEvidence),
  cleanupOnError,
  staffValidation.resolve,
  resolveComplaint,
);

/**
 * ================================
 * Internal Notes Routes
 * ================================
 */

/**
 * @route   POST /api/staff/complaints/:id/notes
 * @desc    Add internal note to complaint
 * @access  Private/Staff (Assigned only)
 */
router.post("/complaints/:id/notes", staffValidation.addNote, addInternalNote);

/**
 * @route   DELETE /api/staff/complaints/:id/notes/:noteId
 * @desc    Delete internal note (own notes only, within 1 hour)
 * @access  Private/Staff
 */
router.delete(
  "/complaints/:id/notes/:noteId",
  staffValidation.deleteNote,
  deleteInternalNote,
);

/**
 * ================================
 * Evidence Routes
 * ================================
 */

/**
 * @route   POST /api/staff/complaints/:id/evidence
 * @desc    Add resolution evidence
 * @access  Private/Staff (Assigned only)
 */
router.post(
  "/complaints/:id/evidence",
  commonValidation.objectIdParam("id"),
  uploadResolutionEvidence,
  cleanupOnError,
  addResolutionEvidence,
);

/**
 * @route   DELETE /api/staff/complaints/:id/evidence/:evidenceId
 * @desc    Delete resolution evidence
 * @access  Private/Staff (Assigned only)
 */
router.delete(
  "/complaints/:id/evidence/:evidenceId",
  commonValidation.objectIdParam("id"),
  deleteResolutionEvidence,
);

/**
 * ================================
 * Reassignment Routes
 * ================================
 */

/**
 * @route   POST /api/staff/complaints/:id/request-reassignment
 * @desc    Request complaint reassignment
 * @access  Private/Staff (Assigned only)
 */
router.post(
  "/complaints/:id/request-reassignment",
  staffValidation.requestReassignment,
  requestReassignment,
);

module.exports = router;
