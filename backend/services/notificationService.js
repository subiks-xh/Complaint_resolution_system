/**
 * Notification Service
 *
 * Centralized notification dispatch and preference enforcement service for CRS.
 *
 * Rules:
 * 1. Channels supported: "inApp", "email".
 * 2. Event categories: "complaintUpdates", "escalationAlerts", "security", "system".
 * 3. Security events (password reset, email verification, password changed) are MANDATORY
 *    and cannot be disabled by user preferences.
 * 4. User preferences are strictly isolated per user and organization.
 * 5. Sensible backward-compatible defaults apply when preferences are not explicitly set:
 *    { inApp: true, email: true, complaintUpdates: true, escalationAlerts: true }
 * 6. External provider failures never break core complaint or assignment workflows.
 */

const User = require("../models/User");
const Notification = require("../models/Notification");
const sendEmailUtil = require("../utils/sendEmail");

// Default preferences for backward compatibility
const DEFAULT_PREFERENCES = {
  inApp: true,
  email: true,
  complaintUpdates: true,
  escalationAlerts: true,
};

// Security event types that are mandatory and bypass user preferences
const MANDATORY_SECURITY_TYPES = [
  "account_update",
  "security_alert",
  "password_reset",
  "email_verification",
];

// Mapping notification types to preference categories
const TYPE_CATEGORY_MAP = {
  // Complaint updates
  complaint_submitted: "complaintUpdates",
  complaint_assigned: "complaintUpdates",
  complaint_updated: "complaintUpdates",
  complaint_resolved: "complaintUpdates",
  complaint_closed: "complaintUpdates",
  complaint_reopened: "complaintUpdates",
  status_change: "complaintUpdates",
  priority_change: "complaintUpdates",
  new_assignment: "complaintUpdates",
  assignment_removed: "complaintUpdates",
  reassignment: "complaintUpdates",
  feedback_received: "complaintUpdates",
  feedback_requested: "complaintUpdates",
  comment_added: "complaintUpdates",
  attachment_added: "complaintUpdates",
  payment_initiated: "complaintUpdates",

  // Escalation alerts
  complaint_escalated: "escalationAlerts",
  escalation_warning: "escalationAlerts",
  sla_breach: "escalationAlerts",

  // System & Security
  account_update: "security",
  security_alert: "security",
  system_announcement: "system",
  maintenance_notice: "system",
};

/**
 * Extract resolved preferences for a user doc or ID
 */
const resolveUserPreferences = (user) => {
  const prefs = user?.notificationPreferences || {};
  return {
    inApp: prefs.inApp !== undefined ? Boolean(prefs.inApp) : DEFAULT_PREFERENCES.inApp,
    email: prefs.email !== undefined ? Boolean(prefs.email) : DEFAULT_PREFERENCES.email,
    complaintUpdates:
      prefs.complaintUpdates !== undefined
        ? Boolean(prefs.complaintUpdates)
        : DEFAULT_PREFERENCES.complaintUpdates,
    escalationAlerts:
      prefs.escalationAlerts !== undefined
        ? Boolean(prefs.escalationAlerts)
        : DEFAULT_PREFERENCES.escalationAlerts,
  };
};

/**
 * Determine if an in-app notification should be sent according to user preferences.
 * Accepts either a populated User document or a user ObjectId / string.
 */
const shouldSendInAppNotification = async (userOrId, type) => {
  // Mandatory security notifications always deliver
  if (MANDATORY_SECURITY_TYPES.includes(type)) {
    return true;
  }

  let user = userOrId;
  if (!user || typeof user === "string" || user._bsontype === "ObjectID" || (user.toString && !user.notificationPreferences)) {
    user = await User.findById(userOrId).select("notificationPreferences role organization");
  }

  const prefs = resolveUserPreferences(user);

  // Global inApp channel switch
  if (!prefs.inApp) {
    return false;
  }

  const category = TYPE_CATEGORY_MAP[type];
  if (category === "complaintUpdates") {
    return prefs.complaintUpdates;
  }
  if (category === "escalationAlerts") {
    return prefs.escalationAlerts;
  }

  return true;
};

/**
 * Determine if an email should be sent according to user preferences.
 * Accepts either a populated User document or a user ObjectId / string.
 */
const shouldSendEmailNotification = async (userOrId, categoryOrType) => {
  if (MANDATORY_SECURITY_TYPES.includes(categoryOrType)) {
    return true;
  }

  let user = userOrId;
  if (!user || typeof user === "string" || user._bsontype === "ObjectID" || (user.toString && !user.notificationPreferences)) {
    user = await User.findById(userOrId).select("notificationPreferences role organization");
  }

  const prefs = resolveUserPreferences(user);

  // Global email channel switch
  if (!prefs.email) {
    return false;
  }

  const category = TYPE_CATEGORY_MAP[categoryOrType] || categoryOrType;
  if (category === "complaintUpdates") {
    return prefs.complaintUpdates;
  }
  if (category === "escalationAlerts") {
    return prefs.escalationAlerts;
  }

  return true;
};

/**
 * Dispatch an in-app notification respecting user preferences
 */
const sendInAppNotification = async (options) => {
  try {
    const { recipient, type } = options;
    if (!recipient) return null;

    let user = options.recipientUser;
    if (!user) {
      user = await User.findById(recipient).select("notificationPreferences role organization");
    }

    if (!user) {
      return null;
    }

    const shouldSend = await shouldSendInAppNotification(user, type);
    if (!shouldSend) {
      return null; // Suppressed by user preference
    }

    return await Notification.create(options);
  } catch (err) {
    console.error("sendInAppNotification error:", err.message);
    return null; // Fail-safe: do not crash caller
  }
};

/**
 * Dispatch an in-app notification using a pre-defined template
 */
const sendInAppFromTemplate = async (options) => {
  try {
    const { recipient, type } = options;
    if (!recipient) return null;

    let user = options.recipientUser;
    if (!user) {
      user = await User.findById(recipient).select("notificationPreferences role organization");
    }

    if (!user) {
      return null;
    }

    const shouldSend = await shouldSendInAppNotification(user, type);
    if (!shouldSend) {
      return null; // Suppressed by user preference
    }

    return await Notification.createFromTemplate(options);
  } catch (err) {
    console.error("sendInAppFromTemplate error:", err.message);
    return null; // Fail-safe
  }
};

/**
 * Filter an array of user IDs/documents for bulk notifications
 */
const filterRecipientsForInApp = async (recipientIds, type) => {
  if (MANDATORY_SECURITY_TYPES.includes(type)) {
    return recipientIds;
  }

  const users = await User.find({ _id: { $in: recipientIds } }).select(
    "_id notificationPreferences",
  );

  const allowedIds = [];
  for (const user of users) {
    const allowed = await shouldSendInAppNotification(user, type);
    if (allowed) {
      allowedIds.push(user._id);
    }
  }

  return allowedIds;
};

/**
 * Dispatch bulk in-app notifications filtering out users who opted out
 */
const sendBulkInAppNotifications = async (recipientIds, notificationData) => {
  try {
    const type = notificationData.type || "system_announcement";
    const allowedRecipients = await filterRecipientsForInApp(recipientIds, type);

    if (allowedRecipients.length === 0) {
      return [];
    }

    return await Notification.createBulk(allowedRecipients, notificationData);
  } catch (err) {
    console.error("sendBulkInAppNotifications error:", err.message);
    return [];
  }
};

/**
 * Dispatch email respecting recipient preferences
 */
const sendUserEmail = async (user, categoryOrType, sendEmailFn) => {
  try {
    if (!user) return null;

    let userDoc = user;
    if (!user.notificationPreferences && (user._id || user.id)) {
      userDoc = await User.findById(user._id || user.id).select(
        "name email notificationPreferences",
      );
    }

    if (!userDoc || !userDoc.email) return null;

    const shouldSend = await shouldSendEmailNotification(userDoc, categoryOrType);
    if (!shouldSend) {
      return { skipped: true, sent: false, reason: "Suppressed by user notification preference" };
    }

    const result = await sendEmailFn();
    return { skipped: false, sent: true, result };
  } catch (err) {
    console.error("sendUserEmail error:", err.message);
    return { skipped: false, sent: false, error: err.message };
  }
};

module.exports = {
  DEFAULT_PREFERENCES,
  MANDATORY_SECURITY_TYPES,
  TYPE_CATEGORY_MAP,
  resolveUserPreferences,
  shouldSendInAppNotification,
  shouldSendEmailNotification,
  sendInAppNotification,
  sendInAppFromTemplate,
  sendBulkInAppNotifications,
  filterRecipientsForInApp,
  sendUserEmail,
};
