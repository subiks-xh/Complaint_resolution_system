/**
 * Notification Model
 *
 * Manages in-app notifications for users, staff, and admins.
 * Supports various notification types and read/unread status tracking.
 */

const mongoose = require("mongoose");

/**
 * Notification Schema
 */
const notificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },

    // Sender (system notifications may not have a sender)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Notification type
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: [
          // Complaint lifecycle
          "complaint_submitted",
          "complaint_assigned",
          "complaint_updated",
          "complaint_resolved",
          "complaint_closed",
          "complaint_reopened",

          // Escalation
          "complaint_escalated",
          "escalation_warning",
          "sla_breach",

          // Assignment
          "new_assignment",
          "assignment_removed",
          "reassignment",

          // Feedback
          "feedback_received",
          "feedback_requested",

          // Status updates
          "status_change",
          "priority_change",

          // System
          "system_announcement",
          "maintenance_notice",
          "account_update",

          // User actions
          "mention",
          "comment_added",
          "attachment_added",
        ],
        message: "Invalid notification type",
      },
    },

    // Notification title
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    // Notification message/body
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },

    // Related entities
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },

    relatedFeedback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
    },

    // Additional data (JSON)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Priority/importance
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },

    // Seen status (viewed in notification list but not opened)
    isSeen: {
      type: Boolean,
      default: false,
    },

    seenAt: {
      type: Date,
    },

    // Action URL (where to navigate when clicked)
    actionUrl: {
      type: String,
    },

    // Action text
    actionText: {
      type: String,
      default: "View Details",
    },

    // Email notification sent
    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
    },

    // Notification expiry
    expiresAt: {
      type: Date,
    },

    // Archived status
    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
    },

    // Grouping key (for aggregating similar notifications)
    groupKey: {
      type: String,
    },

    // Batch ID (for bulk notifications)
    batchId: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Indexes
 */
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, isSeen: 1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ relatedComplaint: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
notificationSchema.index({ groupKey: 1 });
notificationSchema.index({ batchId: 1 });

/**
 * Virtual Fields
 */

// Time ago
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diff = now - this.createdAt;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
});

// Is expired
notificationSchema.virtual("isExpired").get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

/**
 * Instance Methods
 */

// Mark as read
notificationSchema.methods.markAsRead = function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    if (!this.isSeen) {
      this.isSeen = true;
      this.seenAt = new Date();
    }
  }
  return this.save();
};

// Mark as seen
notificationSchema.methods.markAsSeen = function () {
  if (!this.isSeen) {
    this.isSeen = true;
    this.seenAt = new Date();
  }
  return this.save();
};

// Archive notification
notificationSchema.methods.archive = function () {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Get display data
notificationSchema.methods.toDisplay = function () {
  return {
    id: this._id,
    type: this.type,
    title: this.title,
    message: this.message,
    priority: this.priority,
    isRead: this.isRead,
    isSeen: this.isSeen,
    timeAgo: this.timeAgo,
    actionUrl: this.actionUrl,
    actionText: this.actionText,
    createdAt: this.createdAt,
    metadata: this.metadata,
  };
};

/**
 * Static Methods
 */

// Create notification with template
notificationSchema.statics.createFromTemplate = async function (options) {
  const { type, recipient, sender, complaint, customData = {} } = options;

  // Notification templates
  const templates = {
    complaint_submitted: {
      title: "Complaint Submitted",
      message: `Your complaint "${customData.complaintTitle}" has been submitted successfully.`,
      actionText: "View Complaint",
    },
    complaint_assigned: {
      title: "New Complaint Assigned",
      message: `A complaint "${customData.complaintTitle}" has been assigned to you.`,
      priority: "high",
      actionText: "View Complaint",
    },
    complaint_updated: {
      title: "Complaint Updated",
      message: `Your complaint "${customData.complaintTitle}" has been updated.`,
      actionText: "View Update",
    },
    complaint_resolved: {
      title: "Complaint Resolved",
      message: `Your complaint "${customData.complaintTitle}" has been resolved. Please provide feedback.`,
      priority: "high",
      actionText: "View & Give Feedback",
    },
    complaint_closed: {
      title: "Complaint Closed",
      message: `Your complaint "${customData.complaintTitle}" has been closed.`,
      actionText: "View Details",
    },
    complaint_escalated: {
      title: "Complaint Escalated",
      message: `Complaint "${customData.complaintTitle}" has been escalated due to ${customData.reason || "SLA breach"}.`,
      priority: "urgent",
      actionText: "Take Action",
    },
    sla_breach: {
      title: "SLA Breach Warning",
      message: `Complaint "${customData.complaintTitle}" has breached its SLA deadline.`,
      priority: "urgent",
      actionText: "View Complaint",
    },
    escalation_warning: {
      title: "Escalation Warning",
      message: `Complaint "${customData.complaintTitle}" is approaching its deadline and may be escalated soon.`,
      priority: "high",
      actionText: "Take Action",
    },
    new_assignment: {
      title: "New Assignment",
      message: `You have been assigned to complaint "${customData.complaintTitle}".`,
      priority: "high",
      actionText: "View Assignment",
    },
    feedback_received: {
      title: "Feedback Received",
      message: `New feedback received for complaint "${customData.complaintTitle}".`,
      actionText: "View Feedback",
    },
    feedback_requested: {
      title: "Feedback Requested",
      message: `Please provide feedback for your resolved complaint "${customData.complaintTitle}".`,
      actionText: "Give Feedback",
    },
    status_change: {
      title: "Status Updated",
      message: `Complaint "${customData.complaintTitle}" status changed to ${customData.newStatus}.`,
      actionText: "View Details",
    },
    system_announcement: {
      title: customData.title || "System Announcement",
      message: customData.message || "You have a new system announcement.",
      actionText: "Read More",
    },
  };

  const template = templates[type];

  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const notificationData = {
    recipient,
    sender,
    type,
    title: customData.title || template.title,
    message: customData.message || template.message,
    priority: customData.priority || template.priority || "normal",
    actionText: template.actionText,
    actionUrl: complaint ? `/complaints/${complaint}` : customData.actionUrl,
    relatedComplaint: complaint,
    metadata: customData,
  };

  return this.create(notificationData);
};

// Create bulk notifications
notificationSchema.statics.createBulk = async function (
  recipientIds,
  notificationData,
) {
  const batchId = new mongoose.Types.ObjectId().toString();

  const notifications = recipientIds.map((recipientId) => ({
    ...notificationData,
    recipient: recipientId,
    batchId,
  }));

  return this.insertMany(notifications);
};

// Get unread count for user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false,
    isArchived: false,
  });
};

// Get unseen count for user
notificationSchema.statics.getUnseenCount = async function (userId) {
  return this.countDocuments({
    recipient: userId,
    isSeen: false,
    isArchived: false,
  });
};

// Get notifications for user
notificationSchema.statics.getForUser = function (userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    unreadOnly = false,
    type = null,
    includeArchived = false,
  } = options;

  const query = { recipient: userId };

  if (unreadOnly) {
    query.isRead = false;
  }

  if (!includeArchived) {
    query.isArchived = false;
  }

  if (type) {
    if (Array.isArray(type)) {
      query.type = { $in: type };
    } else {
      query.type = type;
    }
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "name avatar")
    .populate("relatedComplaint", "complaintId title status");
};

// Mark all as read for user
notificationSchema.statics.markAllAsRead = async function (
  userId,
  type = null,
) {
  const query = {
    recipient: userId,
    isRead: false,
  };

  if (type) {
    query.type = type;
  }

  const result = await this.updateMany(query, {
    $set: {
      isRead: true,
      readAt: new Date(),
      isSeen: true,
      seenAt: new Date(),
    },
  });

  return result.modifiedCount;
};

// Mark all as seen for user
notificationSchema.statics.markAllAsSeen = async function (userId) {
  const result = await this.updateMany(
    {
      recipient: userId,
      isSeen: false,
    },
    {
      $set: {
        isSeen: true,
        seenAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};

// Archive old notifications
notificationSchema.statics.archiveOld = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.updateMany(
    {
      createdAt: { $lt: cutoffDate },
      isArchived: false,
    },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};

// Delete old archived notifications
notificationSchema.statics.deleteOldArchived = async function (daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    isArchived: true,
    archivedAt: { $lt: cutoffDate },
  });

  return result.deletedCount;
};

// Get notification statistics for user
notificationSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId),
        isArchived: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: ["$isRead", 0, 1] } },
        unseen: { $sum: { $cond: ["$isSeen", 0, 1] } },
        urgent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$priority", "urgent"] },
                  { $eq: ["$isRead", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return stats[0] || { total: 0, unread: 0, unseen: 0, urgent: 0 };
};

// Group similar notifications
notificationSchema.statics.getGrouped = async function (userId, limit = 10) {
  return this.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId),
        isArchived: false,
        groupKey: { $exists: true, $ne: null },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: "$groupKey",
        latestNotification: { $first: "$$ROOT" },
        count: { $sum: 1 },
        unreadCount: { $sum: { $cond: ["$isRead", 0, 1] } },
      },
    },
    { $limit: limit },
  ]);
};

// Create and export the model
const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
