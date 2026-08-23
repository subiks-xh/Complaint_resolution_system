const express = require("express");
const router = express.Router();

const {
  initiateComplaintPayment,
  confirmPayment,
  getMyPayments,
  getAdminPaymentSummary,
  getStaffIncentiveView,
  getComplaintPaymentStatuses,
  getPaymentReceipt,
  refundPayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");
const { restrictTo, adminOnly } = require("../middleware/roleMiddleware");

router.use(protect);

// User-facing payment flow
router.post(
  "/complaints/:id/initiate",
  restrictTo("user", "admin", "org_admin", "super_admin"),
  initiateComplaintPayment,
);
router.get(
  "/complaints/status",
  restrictTo("user", "staff", "admin", "org_admin", "super_admin"),
  getComplaintPaymentStatuses,
);
router.post(
  "/:paymentId/confirm",
  restrictTo("user", "admin", "org_admin", "super_admin"),
  confirmPayment,
);
router.get(
  "/my-payments",
  restrictTo("user", "admin", "org_admin", "super_admin"),
  getMyPayments,
);
router.get(
  "/:paymentId/receipt",
  restrictTo("user", "admin", "org_admin", "super_admin"),
  getPaymentReceipt,
);

// Role-specific views
router.get(
  "/staff/incentives",
  restrictTo("staff", "admin", "org_admin", "super_admin"),
  getStaffIncentiveView,
);
router.get("/admin/summary", adminOnly, getAdminPaymentSummary);
router.post("/:paymentId/refund", adminOnly, refundPayment);

module.exports = router;
