/**
 * Notification Controller
 *
 * Handles notification operations:
 * - Creating notifications
 * - Retrieving notifications
 * - Marking as read/unread
 * - Real-time notification management
 */

const Notification = require("../models/Notification");
const User = require("../models/User");

const setNoCacheHeaders = (res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
};

/**
 * @desc    Get admin notifications
 * @route   GET /api/admin/notifications
 * @access  Private/Admin
 */
const getAdminNotifications = async (req, res) => {
  try {
    setNoCacheHeaders(res);

    const { page = 1, limit = 50, type, isRead } = req.query;

    // Build filter based on user role and organization
    const filter = {};

    // Only show notifications for this admin's organization
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    if (type) {
      filter.type = type;
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    // Get notifications for admin role
    filter.recipient = req.user.id;

    const notifications = await Notification.find(filter)
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Get admin notifications error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications",
      error: err.message,
    });
  }
};

/**
 * @desc    Get urgent notifications only
 * @route   GET /api/admin/notifications/urgent
 * @access  Private/Admin
 */
const getUrgentNotifications = async (req, res) => {
  try {
    setNoCacheHeaders(res);

    const urgentTypes = [
      "sla_breach",
      "escalation_warning",
      "complaint_escalated",
      "system_alert",
    ];

    const filter = {
      recipient: req.user.id,
      type: { $in: urgentTypes },
      isRead: false,
    };

    // Only show notifications for this admin's organization
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    const notifications = await Notification.find(filter)
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    console.error("Get urgent notifications error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve urgent notifications",
      error: err.message,
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/admin/notifications/:id/read
 * @access  Private/Admin
 */
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id, // Ensure user can only mark their own notifications
      },
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: err.message,
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/admin/notifications/mark-all-read
 * @access  Private/Admin
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user.id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: err.message,
    });
  }
};

/**
 * @desc    Create a new notification
 * @route   POST /api/notifications
 * @access  Internal (for system use)
 */
const createNotification = async ({
  recipient,
  sender = null,
  type,
  message,
  metadata = {},
  organization = null,
}) => {
  try {
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      metadata,
      organization,
    });

    return notification;
  } catch (err) {
    console.error("Create notification error:", err);
    throw err;
  }
};

/**
 * @desc    Create bulk notifications
 * @route   Internal helper function
 * @access  Internal (for system use)
 */
const createBulkNotifications = async (notifications) => {
  try {
    const result = await Notification.insertMany(notifications);
    return result;
  } catch (err) {
    console.error("Create bulk notifications error:", err);
    throw err;
  }
};

/**
 * @desc    Send escalation notifications
 * @route   Internal helper function
 * @access  Internal (for system use)
 */
const sendEscalationNotification = async (
  complaint,
  escalationType = "manual",
) => {
  try {
    // Get all admins in the same organization
    const admins = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin"] },
      organization: complaint.organization,
    });

    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      type: "complaint_escalated",
      message: `Complaint ${complaint.complaintId} has been ${escalationType} escalated`,
      metadata: {
        complaintId: complaint.complaintId,
        complaint: complaint._id,
        escalationType,
        priority: complaint.priority,
        category: complaint.category?.name,
      },
      organization: complaint.organization,
    }));

    await createBulkNotifications(notifications);

    return {
      success: true,
      notificationsSent: notifications.length,
    };
  } catch (err) {
    console.error("Send escalation notification error:", err);
    throw err;
  }
};

/**
 * @desc    Send SLA breach notification
 * @route   Internal helper function
 * @access  Internal (for system use)
 */
const sendSLABreachNotification = async (complaint) => {
  try {
    // Get all admins and supervisors in the same organization
    const recipients = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin", "staff"] },
      organization: complaint.organization,
      // Only notify staff who are supervisors or the assigned staff
      $or: [
        { role: { $in: ["admin", "org_admin", "super_admin"] } },
        { _id: complaint.assignedTo },
        { isSupervisor: true },
      ],
    });

    const notifications = recipients.map((recipient) => ({
      recipient: recipient._id,
      type: "sla_breach",
      message: `SLA breach detected for complaint ${complaint.complaintId}`,
      metadata: {
        complaintId: complaint.complaintId,
        complaint: complaint._id,
        priority: complaint.priority,
        category: complaint.category?.name,
        timeOverdue: Math.floor(
          (new Date() - complaint.createdAt) / (1000 * 60 * 60),
        ), // hours
      },
      organization: complaint.organization,
    }));

    await createBulkNotifications(notifications);

    return {
      success: true,
      notificationsSent: notifications.length,
    };
  } catch (err) {
    console.error("Send SLA breach notification error:", err);
    throw err;
  }
};

module.exports = {
  getAdminNotifications,
  getUrgentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  createBulkNotifications,
  sendEscalationNotification,
  sendSLABreachNotification,
};
