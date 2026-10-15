const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");

const PRIORITY_AMOUNTS = {
  low: 99,
  medium: 199,
  high: 299,
  critical: 399,
};

const getBoostedPriority = (priority) => {
  if (priority === "low") return "medium";
  if (priority === "medium") return "high";
  if (priority === "high") return "critical";
  return "critical";
};

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const adminRoles = ["admin", "org_admin", "super_admin"];

const initiateComplaintPayment = async (req, res) => {
  try {
    const { id: complaintIdParam } = req.params;
    const { method = "demo", purpose = "premium_escalation", notes } = req.body;

    const complaintQuery = isObjectId(complaintIdParam)
      ? { _id: complaintIdParam }
      : { complaintId: complaintIdParam };

    const complaint = await Complaint.findOne(complaintQuery).select(
      "_id complaintId priority status user organization assignedTo",
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found. Use complaint ObjectId or complaintId.",
      });
    }

    const isOwner = complaint.user.toString() === req.user.id;
    const isAdmin = adminRoles.includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to initiate payment for this complaint",
      });
    }

    if (
      isAdmin &&
      req.user.role !== "super_admin" &&
      req.user.organization &&
      complaint.organization?.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Cannot initiate payment for complaints outside your organization",
      });
    }

    if (["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Payment not allowed for resolved/closed complaints",
      });
    }

    const amount =
      PRIORITY_AMOUNTS[complaint.priority] || PRIORITY_AMOUNTS.medium;

    const payment = await Payment.create({
      organization: complaint.organization,
      complaint: complaint._id,
      paidBy: req.user.id,
      amount,
      method,
      purpose,
      notes,
      gateway: method === "demo" ? "none" : "razorpay",
      gatewayOrderId:
        method === "demo"
          ? `DEMO-ORDER-${Date.now()}`
          : `RZP-TEST-ORDER-${Date.now()}`,
      metadata: {
        complaintPriorityAtPayment: complaint.priority,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        paymentId: payment._id,
        paymentRef: payment.paymentRef,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        checkout: {
          provider: payment.gateway === "razorpay" ? "razorpay" : "demo",
          amountPaise: Math.round(payment.amount * 100),
          currency: payment.currency,
          orderId: payment.gatewayOrderId,
        },
      },
    });
  } catch (error) {
    console.error("initiateComplaintPayment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to initiate payment" });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { gatewayPaymentId, markAsPaid = true } = req.body;

    if (!isObjectId(paymentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(paymentId)
      .populate("complaint", "_id complaintId user priority status assignedTo")
      .populate("paidBy", "_id name");

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const isOwner = payment.paidBy?._id?.toString() === req.user.id;
    const isAdmin = ["admin", "org_admin", "super_admin"].includes(
      req.user.role,
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to confirm this payment",
      });
    }

    if (payment.status === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already confirmed",
        data: payment,
      });
    }

    payment.status = markAsPaid ? "paid" : "failed";
    payment.paidAt = markAsPaid ? new Date() : null;
    payment.gatewayPaymentId = gatewayPaymentId || payment.gatewayPaymentId;

    await payment.save();

    if (markAsPaid && payment.complaint) {
      const complaint = await Complaint.findById(payment.complaint._id);
      if (complaint && !["resolved", "closed"].includes(complaint.status)) {
        const oldPriority = complaint.priority;
        const newPriority = getBoostedPriority(oldPriority);

        if (newPriority !== oldPriority) {
          complaint.priority = newPriority;
          complaint.internalNotes.push({
            note: `[SYSTEM] Priority boosted from ${oldPriority} to ${newPriority} via payment ${payment.paymentRef}`,
            addedBy: req.user.id,
            addedAt: new Date(),
          });
          await complaint.save();
        }

        if (complaint.assignedTo) {
          await notificationService.sendInAppNotification({
            recipient: complaint.assignedTo,
            type: "priority_change",
            title: "Complaint Priority Upgraded",
            message: `Complaint ${complaint.complaintId} priority was upgraded after payment confirmation.`,
            priority: "high",
            relatedComplaint: complaint._id,
            actionUrl: `/staff/complaints/${complaint._id}`,
          });
        }
      }

      if (complaint?.paymentWorkflow?.isPaymentRequested) {
        complaint.paymentWorkflow.paymentStatus = markAsPaid
          ? "paid"
          : "requested";
        if (!markAsPaid) {
          complaint.paymentWorkflow.acknowledgedAt = null;
          complaint.paymentWorkflow.acknowledgedBy = null;
        }

        complaint.internalNotes.push({
          note: markAsPaid
            ? `[PAYMENT] User completed payment ${payment.paymentRef}. Awaiting staff acknowledgement.`
            : `[PAYMENT] Payment ${payment.paymentRef} marked as failed.`,
          addedBy: req.user.id,
          addedAt: new Date(),
        });

        await complaint.save();

        if (markAsPaid && complaint.assignedTo) {
          await notificationService.sendInAppNotification({
            recipient: complaint.assignedTo,
            type: "payment_initiated",
            title: "User payment completed",
            message: `Payment for complaint ${complaint.complaintId} is completed. Please acknowledge to allow admin closure.`,
            priority: "high",
            relatedComplaint: complaint._id,
            actionUrl: `/staff/complaints/${complaint._id}`,
            metadata: {
              paymentId: payment._id,
              paymentRef: payment.paymentRef,
            },
          });

          try {
            const staff = await User.findById(complaint.assignedTo).select(
              "name email notificationPreferences",
            );
            if (staff?.email) {
              await notificationService.sendUserEmail(
                staff,
                "complaintUpdates",
                () =>
                  sendEmail({
                    to: staff.email,
                    subject: `Payment Completed: ${complaint.complaintId}`,
                    html: `<p>Hello ${staff.name || "Staff"},</p><p>User payment is completed for complaint <strong>${complaint.complaintId}</strong>. Please acknowledge the payment to enable admin closure.</p>`,
                    text: `Hello ${staff.name || "Staff"},\n\nUser payment is completed for complaint ${complaint.complaintId}. Please acknowledge the payment to enable admin closure.`,
                  }),
              );
            }
          } catch (emailError) {
            console.warn(
              "Staff payment completion email failed:",
              emailError.message,
            );
          }
        }

        if (markAsPaid) {
          try {
            const admins = await User.find({
              organization: complaint.organization,
              role: { $in: adminRoles },
              isActive: true,
            }).select("name email notificationPreferences");

            await Promise.all(
              admins
                .filter((admin) => !!admin.email)
                .map((admin) =>
                  notificationService.sendUserEmail(
                    admin,
                    "complaintUpdates",
                    () =>
                      sendEmail({
                        to: admin.email,
                        subject: `Payment Received: ${complaint.complaintId}`,
                        html: `<p>Hello ${admin.name || "Admin"},</p><p>Payment has been received for complaint <strong>${complaint.complaintId}</strong>. Waiting for staff acknowledgement before closure.</p>`,
                        text: `Hello ${admin.name || "Admin"},\n\nPayment has been received for complaint ${complaint.complaintId}. Waiting for staff acknowledgement before closure.`,
                      }),
                  ),
                ),
            );
          } catch (emailError) {
            console.warn(
              "Admin payment received emails failed:",
              emailError.message,
            );
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: markAsPaid ? "Payment confirmed" : "Payment marked as failed",
      data: payment,
    });
  } catch (error) {
    console.error("confirmPayment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to confirm payment" });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      50,
    );
    const skip = (page - 1) * limit;

    const filter = {};
    const isAdmin = adminRoles.includes(req.user.role);
    const scope = (req.query.scope || "mine").toLowerCase();

    if (scope === "organization" && isAdmin) {
      if (req.user.role !== "super_admin") {
        filter.organization = req.user.organization;
      } else if (req.query.organization && isObjectId(req.query.organization)) {
        filter.organization = new mongoose.Types.ObjectId(
          req.query.organization,
        );
      }
    } else {
      filter.paidBy = req.user.id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("complaint", "complaintId title priority status")
        .populate("paidBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMyPayments error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch payments" });
  }
};

const getAdminPaymentSummary = async (req, res) => {
  try {
    const orgFilter =
      req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization };

    const summary = await Payment.aggregate([
      { $match: orgFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const methodSummary = await Payment.aggregate([
      { $match: orgFilter },
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        byStatus: summary,
        byMethod: methodSummary,
      },
    });
  } catch (error) {
    console.error("getAdminPaymentSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin payment summary",
    });
  }
};

const getStaffIncentiveView = async (req, res) => {
  try {
    const matchPaid = { status: "paid" };

    const results = await Payment.aggregate([
      { $match: matchPaid },
      {
        $lookup: {
          from: "complaints",
          localField: "complaint",
          foreignField: "_id",
          as: "complaintDoc",
        },
      },
      { $unwind: "$complaintDoc" },
      {
        $match: {
          "complaintDoc.assignedTo": new mongoose.Types.ObjectId(req.user.id),
        },
      },
      {
        $group: {
          _id: "$complaintDoc._id",
          complaintId: { $first: "$complaintDoc.complaintId" },
          amount: { $sum: "$amount" },
          payments: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error("getStaffIncentiveView error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch staff payment view" });
  }
};

const getComplaintPaymentStatuses = async (req, res) => {
  try {
    const rawComplaintIds = String(req.query.complaintIds || "").trim();
    if (!rawComplaintIds) {
      return res.status(400).json({
        success: false,
        message: "complaintIds query param is required",
      });
    }

    const complaintIds = rawComplaintIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .filter(isObjectId)
      .slice(0, 100)
      .map((id) => new mongoose.Types.ObjectId(id));

    if (complaintIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide valid complaint ObjectIds" });
    }

    const complaintFilter = { _id: { $in: complaintIds } };

    if (req.user.role === "user") {
      complaintFilter.user = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role === "staff") {
      complaintFilter.assignedTo = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role !== "super_admin") {
      complaintFilter.organization = new mongoose.Types.ObjectId(
        req.user.organization,
      );
    }

    const allowedComplaints =
      await Complaint.find(complaintFilter).select("_id");
    const allowedComplaintIds = allowedComplaints.map((c) => c._id);

    if (allowedComplaintIds.length === 0) {
      return res.status(200).json({ success: true, data: {} });
    }

    const statusRows = await Payment.aggregate([
      { $match: { complaint: { $in: allowedComplaintIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$complaint",
          latestStatus: { $first: "$status" },
          latestPaymentRef: { $first: "$paymentRef" },
          latestUpdatedAt: { $first: "$updatedAt" },
          totalPayments: { $sum: 1 },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, 1, 0],
            },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const byComplaint = statusRows.reduce((acc, row) => {
      acc[row._id.toString()] = {
        latestStatus: row.latestStatus,
        latestPaymentRef: row.latestPaymentRef,
        latestUpdatedAt: row.latestUpdatedAt,
        totalPayments: row.totalPayments,
        paidCount: row.paidCount,
        paidAmount: row.paidAmount,
      };
      return acc;
    }, {});

    return res.status(200).json({ success: true, data: byComplaint });
  } catch (error) {
    console.error("getComplaintPaymentStatuses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint payment statuses",
    });
  }
};

const getPaymentReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!isObjectId(paymentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(paymentId)
      .populate("complaint", "_id complaintId title priority status assignedTo")
      .populate("paidBy", "_id name email");

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const isOwner = payment.paidBy?._id?.toString() === req.user.id;
    const isAdmin = ["admin", "org_admin", "super_admin"].includes(
      req.user.role,
    );
    const isAssignee =
      payment.complaint?.assignedTo &&
      payment.complaint.assignedTo.toString() === req.user.id;

    if (!isOwner && !isAdmin && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this receipt",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        receiptNo: payment.paymentRef,
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        purpose: payment.purpose,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        complaint: {
          id: payment.complaint?._id,
          complaintId: payment.complaint?.complaintId,
          title: payment.complaint?.title,
          priority: payment.complaint?.priority,
          status: payment.complaint?.status,
        },
        paidBy: {
          id: payment.paidBy?._id,
          name: payment.paidBy?.name,
          email: payment.paidBy?.email,
        },
      },
    });
  } catch (error) {
    console.error("getPaymentReceipt error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch payment receipt" });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    if (!isObjectId(paymentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(paymentId)
      .populate("paidBy", "_id name")
      .populate("complaint", "_id complaintId");

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Only paid transactions can be refunded",
      });
    }

    payment.status = "refunded";
    payment.metadata = {
      ...payment.metadata,
      refundedBy: req.user.id,
      refundReason: reason || "Refund initiated by admin",
      refundedAt: new Date(),
    };

    await payment.save();

    await Notification.create({
      recipient: payment.paidBy._id,
      type: "account_update",
      title: "Payment Refunded",
      message: `Payment ${payment.paymentRef} has been refunded${reason ? `: ${reason}` : "."}`,
      priority: "normal",
      relatedComplaint: payment.complaint?._id,
      actionUrl: "/payments/my-payments",
    });

    return res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: payment,
    });
  } catch (error) {
    console.error("refundPayment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to refund payment" });
  }
};

module.exports = {
  initiateComplaintPayment,
  confirmPayment,
  getMyPayments,
  getAdminPaymentSummary,
  getStaffIncentiveView,
  getComplaintPaymentStatuses,
  getPaymentReceipt,
  refundPayment,
};
