/**
 * Escalation Scheduler
 *
 * Automated escalation system using cron jobs:
 * - SLA breach detection
 * - Auto-escalation of overdue complaints
 * - Warning notifications before deadlines
 * - Escalation reporting
 */

const cron = require("node-cron");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEscalationAlertEmail } = require("./sendEmail");

/**
 * Scheduler Configuration
 */
const config = {
  // Run escalation check every hour
  escalationCheckCron: process.env.ESCALATION_CRON || "0 * * * *",

  // Run warning check every 30 minutes
  warningCheckCron: process.env.WARNING_CRON || "*/30 * * * *",

  // Run daily summary at 9 AM
  dailySummaryCron: process.env.DAILY_SUMMARY_CRON || "0 9 * * *",

  // Warning threshold (hours before deadline)
  warningThresholdHours: parseInt(process.env.WARNING_THRESHOLD_HOURS) || 4,

  // Maximum escalation levels
  maxEscalationLevel: parseInt(process.env.MAX_ESCALATION_LEVEL) || 3,

  // Re-escalate after N hours if unresolved
  reEscalationHours: parseInt(process.env.RE_ESCALATION_HOURS) || 24,

  // Avoid noisy duplicate warnings
  warningCooldownHours: parseInt(process.env.WARNING_COOLDOWN_HOURS) || 2,

  // Scheduler timezone
  schedulerTimezone: process.env.SCHEDULER_TIMEZONE || process.env.TZ || "UTC",

  // Enable/disable scheduler
  enabled: process.env.ENABLE_SCHEDULER !== "false",
};

/**
 * Scheduled Jobs Registry
 */
const scheduledJobs = {};

/**
 * Admin recipients for escalation notifications
 * - Organization admins for tenant-specific alerts
 * - Super admins for global oversight
 */
const getAdminRecipients = async (organizationId) => {
  if (!organizationId) {
    return User.find({ role: "super_admin", isActive: true }).select(
      "_id name email",
    );
  }

  return User.find({
    isActive: true,
    $or: [
      { role: "super_admin" },
      { role: "org_admin", organization: organizationId },
    ],
  }).select("_id name email");
};

/**
 * Check and Escalate Overdue Complaints
 *
 * Main escalation logic - runs periodically to check for SLA breaches
 */
const checkAndEscalateComplaints = async () => {
  console.log("🔄 Running escalation check...");

  try {
    const now = new Date();

    // Find complaints that have breached SLA
    const overdueComplaints = await Complaint.find({
      status: { $nin: ["resolved", "closed", "escalated"] },
      resolutionDeadline: { $lt: now },
      slaBreached: { $ne: true },
    })
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("category", "name escalationConfig");

    console.log(`📋 Found ${overdueComplaints.length} overdue complaints`);

    let escalatedCount = 0;
    let notificationsSent = 0;

    for (const complaint of overdueComplaints) {
      try {
        // Mark SLA as breached
        complaint.slaBreached = true;

        // Check if auto-escalation is enabled for this category
        const autoEscalate =
          complaint.category?.escalationConfig?.autoEscalate !== false;

        if (
          autoEscalate &&
          complaint.escalationLevel < config.maxEscalationLevel
        ) {
          // Escalate the complaint
          complaint.escalationLevel += 1;
          complaint.status = "escalated";
          complaint.timeline.escalatedAt = now;
          complaint.timeline.lastUpdatedAt = now;

          // Add escalation history
          complaint.escalationHistory.push({
            escalatedAt: now,
            escalationLevel: complaint.escalationLevel,
            reason: "SLA breach - automatic escalation",
            escalationType: "auto",
            previousAssignee: complaint.assignedTo?._id,
          });

          // Add status history
          complaint.statusHistory.push({
            status: "escalated",
            changedBy: null, // System
            changedByRole: "system",
            remarks: `Auto-escalated due to SLA breach. Level: ${complaint.escalationLevel}`,
            changedAt: now,
          });

          escalatedCount++;
        }

        await complaint.save();

        // Send notifications
        const notificationPromises = [];

        // Notify organization admins and super admins
        const admins = await getAdminRecipients(complaint.organization);

        for (const admin of admins) {
          // In-app notification
          notificationPromises.push(
            Notification.create({
              recipient: admin._id,
              type: "sla_breach",
              title: "SLA Breach Alert",
              message: `Complaint "${complaint.complaintId}" has breached its SLA deadline and has been ${autoEscalate ? "escalated" : "flagged"}.`,
              priority: "urgent",
              relatedComplaint: complaint._id,
              actionUrl: `/admin/complaints/${complaint._id}`,
              metadata: {
                complaintId: complaint.complaintId,
                escalationLevel: complaint.escalationLevel,
                breachTime: now,
              },
            }),
          );

          // Email notification
          notificationPromises.push(
            sendEscalationAlertEmail(
              admin,
              complaint,
              "SLA breach - automatic escalation",
              complaint.escalationLevel,
            ),
          );
        }

        // Notify assigned staff if exists
        if (complaint.assignedTo) {
          notificationPromises.push(
            Notification.create({
              recipient: complaint.assignedTo._id,
              type: "complaint_escalated",
              title: "Complaint Escalated",
              message: `Complaint "${complaint.complaintId}" has been escalated due to SLA breach.`,
              priority: "urgent",
              relatedComplaint: complaint._id,
              actionUrl: `/staff/complaints/${complaint._id}`,
            }),
          );
        }

        // Notify the user
        notificationPromises.push(
          Notification.create({
            recipient: complaint.user._id,
            type: "complaint_escalated",
            title: "Complaint Escalated",
            message: `Your complaint "${complaint.complaintId}" has been escalated for priority handling.`,
            priority: "high",
            relatedComplaint: complaint._id,
            actionUrl: `/complaints/${complaint._id}`,
          }),
        );

        await Promise.allSettled(notificationPromises);
        notificationsSent += notificationPromises.length;
      } catch (error) {
        console.error(
          `Error processing complaint ${complaint.complaintId}:`,
          error,
        );
      }
    }

    console.log(
      `✅ Escalation check complete. Escalated: ${escalatedCount}, Notifications: ${notificationsSent}`,
    );

    return {
      checked: overdueComplaints.length,
      escalated: escalatedCount,
      notifications: notificationsSent,
    };
  } catch (error) {
    console.error("❌ Error in escalation check:", error);
    throw error;
  }
};

/**
 * Send Warning Notifications for Approaching Deadlines
 *
 * Sends notifications before complaints breach SLA
 */
const sendDeadlineWarnings = async () => {
  console.log("🔔 Checking for approaching deadlines...");

  try {
    const now = new Date();
    const warningThreshold = new Date(
      now.getTime() + config.warningThresholdHours * 60 * 60 * 1000,
    );
    const warningCooldownThreshold = new Date(
      now.getTime() - config.warningCooldownHours * 60 * 60 * 1000,
    );

    // Find complaints approaching deadline
    const approachingDeadline = await Complaint.find({
      status: { $in: ["assigned", "in-progress", "reopened"] },
      resolutionDeadline: {
        $gt: now,
        $lte: warningThreshold,
      },
      slaBreached: { $ne: true },
      // Avoid sending duplicate warnings too frequently
      $or: [
        { "warningTracking.lastSentAt": { $exists: false } },
        { "warningTracking.lastSentAt": { $lt: warningCooldownThreshold } },
      ],
    })
      .populate("assignedTo", "name email notificationPreferences")
      .populate("category", "name");

    console.log(
      `⏰ Found ${approachingDeadline.length} complaints approaching deadline`,
    );

    let warningsSent = 0;

    for (const complaint of approachingDeadline) {
      try {
        if (!complaint.assignedTo) continue;

        // Check notification preferences
        if (
          complaint.assignedTo.notificationPreferences?.escalationAlerts ===
          false
        ) {
          continue;
        }

        const hoursRemaining = Math.ceil(
          (new Date(complaint.resolutionDeadline) - now) / (1000 * 60 * 60),
        );

        // Send in-app notification
        await Notification.create({
          recipient: complaint.assignedTo._id,
          type: "escalation_warning",
          title: "Deadline Approaching",
          message: `Complaint "${complaint.complaintId}" deadline is in ${hoursRemaining} hour(s). Please resolve to avoid escalation.`,
          priority: "high",
          relatedComplaint: complaint._id,
          actionUrl: `/staff/complaints/${complaint._id}`,
          metadata: {
            deadline: complaint.resolutionDeadline,
            hoursRemaining,
          },
        });

        // Mark warning as sent
        complaint.warningTracking = {
          lastSentAt: now,
          sentCount: (complaint.warningTracking?.sentCount || 0) + 1,
        };

        // Keep an internal audit note
        complaint.internalNotes.push({
          note: `[SYSTEM] Deadline warning sent - ${hoursRemaining} hours remaining`,
          addedBy: null,
          addedAt: now,
        });

        await complaint.save();
        warningsSent++;
      } catch (error) {
        console.error(
          `Error sending warning for ${complaint.complaintId}:`,
          error,
        );
      }
    }

    console.log(`✅ Deadline warnings sent: ${warningsSent}`);

    return { checked: approachingDeadline.length, warningsSent };
  } catch (error) {
    console.error("❌ Error sending deadline warnings:", error);
    throw error;
  }
};

/**
 * Generate Daily Escalation Summary
 *
 * Sends summary of escalations and SLA status to admins
 */
const generateDailySummary = async () => {
  console.log("📊 Generating daily escalation summary...");

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get statistics
    const [
      totalActive,
      totalOverdue,
      escalatedToday,
      resolvedToday,
      byStatus,
      byPriority,
    ] = await Promise.all([
      // Total active complaints
      Complaint.countDocuments({
        status: { $nin: ["resolved", "closed"] },
      }),

      // Total overdue
      Complaint.countDocuments({
        status: { $nin: ["resolved", "closed"] },
        resolutionDeadline: { $lt: now },
      }),

      // Escalated in last 24 hours
      Complaint.countDocuments({
        "timeline.escalatedAt": { $gte: yesterday },
      }),

      // Resolved in last 24 hours
      Complaint.countDocuments({
        "timeline.resolvedAt": { $gte: yesterday },
      }),

      // Status breakdown
      Complaint.aggregate([
        { $match: { status: { $nin: ["resolved", "closed"] } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Priority breakdown for active
      Complaint.aggregate([
        { $match: { status: { $nin: ["resolved", "closed"] } } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
    ]);

    // Format summary
    const summary = {
      date: now.toISOString().split("T")[0],
      overview: {
        totalActive,
        totalOverdue,
        escalatedToday,
        resolvedToday,
        overduePercentage:
          totalActive > 0 ? Math.round((totalOverdue / totalActive) * 100) : 0,
      },
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    // Send to all organization admins and super admins
    const admins = await User.find({
      isActive: true,
      role: { $in: ["org_admin", "super_admin"] },
    }).select("_id");

    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: "system_announcement",
        title: "Daily Escalation Summary",
        message: `Active: ${totalActive} | Overdue: ${totalOverdue} | Escalated Today: ${escalatedToday} | Resolved Today: ${resolvedToday}`,
        priority: totalOverdue > 0 ? "high" : "normal",
        metadata: summary,
        actionUrl: "/admin/dashboard",
      });
    }

    console.log("✅ Daily summary generated and sent");

    return summary;
  } catch (error) {
    console.error("❌ Error generating daily summary:", error);
    throw error;
  }
};

/**
 * Re-escalate Already Escalated Complaints
 *
 * Further escalates complaints that remain unresolved after escalation
 */
const reEscalateStaleComplaints = async () => {
  console.log("🔄 Checking for stale escalated complaints...");

  try {
    const now = new Date();
    // Re-escalate if escalated more than configured threshold and still unresolved
    const staleThreshold = new Date(
      now.getTime() - config.reEscalationHours * 60 * 60 * 1000,
    );

    const staleEscalated = await Complaint.find({
      status: "escalated",
      "timeline.escalatedAt": { $lt: staleThreshold },
      escalationLevel: { $lt: config.maxEscalationLevel },
    })
      .populate("user", "name email")
      .populate("assignedTo", "name email");

    console.log(`📋 Found ${staleEscalated.length} stale escalated complaints`);

    let reEscalatedCount = 0;

    for (const complaint of staleEscalated) {
      try {
        // Increase escalation level
        complaint.escalationLevel += 1;
        complaint.timeline.escalatedAt = now;
        complaint.timeline.lastUpdatedAt = now;

        complaint.escalationHistory.push({
          escalatedAt: now,
          escalationLevel: complaint.escalationLevel,
          reason: `Stale escalation - no resolution after ${config.reEscalationHours} hours`,
          escalationType: "auto",
          previousAssignee: complaint.assignedTo?._id,
        });

        complaint.statusHistory.push({
          status: "escalated",
          changedBy: null,
          changedByRole: "system",
          remarks: `Re-escalated due to no resolution. Level: ${complaint.escalationLevel}`,
          changedAt: now,
        });

        await complaint.save();
        reEscalatedCount++;

        // Notify organization admins and super admins
        const admins = await getAdminRecipients(complaint.organization);

        for (const admin of admins) {
          await Notification.create({
            recipient: admin._id,
            type: "complaint_escalated",
            title: `Re-Escalation Alert (Level ${complaint.escalationLevel})`,
            message: `Complaint "${complaint.complaintId}" has been re-escalated due to no resolution after ${config.reEscalationHours} hours.`,
            priority: "urgent",
            relatedComplaint: complaint._id,
            actionUrl: `/admin/complaints/${complaint._id}`,
          });
        }
      } catch (error) {
        console.error(`Error re-escalating ${complaint.complaintId}:`, error);
      }
    }

    console.log(`✅ Re-escalation complete. Re-escalated: ${reEscalatedCount}`);

    return { checked: staleEscalated.length, reEscalated: reEscalatedCount };
  } catch (error) {
    console.error("❌ Error in re-escalation check:", error);
    throw error;
  }
};

/**
 * Clean Up Old Notifications
 *
 * Archives old notifications to keep the system clean
 */
const cleanupOldNotifications = async () => {
  console.log("🧹 Cleaning up old notifications...");

  try {
    // Archive notifications older than 30 days
    const archivedCount = await Notification.archiveOld(30);

    // Delete archived notifications older than 90 days
    const deletedCount = await Notification.deleteOldArchived(90);

    console.log(
      `✅ Cleanup complete. Archived: ${archivedCount}, Deleted: ${deletedCount}`,
    );

    return { archived: archivedCount, deleted: deletedCount };
  } catch (error) {
    console.error("❌ Error cleaning up notifications:", error);
    throw error;
  }
};

/**
 * Start All Scheduled Jobs
 */
const startScheduler = () => {
  if (!config.enabled) {
    console.log("⏸️  Scheduler is disabled");
    return;
  }

  console.log("🚀 Starting escalation scheduler...");

  // Escalation check (hourly)
  scheduledJobs.escalation = cron.schedule(
    config.escalationCheckCron,
    async () => {
      try {
        await checkAndEscalateComplaints();
        await reEscalateStaleComplaints();
      } catch (error) {
        console.error("Scheduled escalation check failed:", error);
      }
    },
    {
      scheduled: true,
      timezone: config.schedulerTimezone,
    },
  );

  // Warning check (every 30 minutes)
  scheduledJobs.warning = cron.schedule(
    config.warningCheckCron,
    async () => {
      try {
        await sendDeadlineWarnings();
      } catch (error) {
        console.error("Scheduled warning check failed:", error);
      }
    },
    {
      scheduled: true,
      timezone: config.schedulerTimezone,
    },
  );

  // Daily summary (9 AM)
  scheduledJobs.dailySummary = cron.schedule(
    config.dailySummaryCron,
    async () => {
      try {
        await generateDailySummary();
        await cleanupOldNotifications();
      } catch (error) {
        console.error("Scheduled daily summary failed:", error);
      }
    },
    {
      scheduled: true,
      timezone: config.schedulerTimezone,
    },
  );

  console.log("✅ Scheduler started successfully");
  console.log(`   - Escalation check: ${config.escalationCheckCron}`);
  console.log(`   - Warning check: ${config.warningCheckCron}`);
  console.log(`   - Daily summary: ${config.dailySummaryCron}`);
};

/**
 * Stop All Scheduled Jobs
 */
const stopScheduler = () => {
  console.log("⏹️  Stopping scheduler...");

  Object.values(scheduledJobs).forEach((job) => {
    if (job && typeof job.stop === "function") {
      job.stop();
    }
  });

  console.log("✅ Scheduler stopped");
};

/**
 * Run Manual Escalation Check
 *
 * Can be triggered manually via admin API
 */
const runManualCheck = async () => {
  console.log("🔧 Running manual escalation check...");

  const results = {
    escalation: await checkAndEscalateComplaints(),
    reEscalation: await reEscalateStaleComplaints(),
    warnings: await sendDeadlineWarnings(),
  };

  return results;
};

/**
 * Get Scheduler Status 
 */
const getSchedulerStatus = () => {
  return {
    enabled: config.enabled,
    jobs: {
      escalation: {
        cron: config.escalationCheckCron,
        running: scheduledJobs.escalation?.running || false,
      },
      warning: {
        cron: config.warningCheckCron,
        running: scheduledJobs.warning?.running || false,
      },
      dailySummary: {
        cron: config.dailySummaryCron,
        running: scheduledJobs.dailySummary?.running || false,
      },
    },
    config: {
      warningThresholdHours: config.warningThresholdHours,
      maxEscalationLevel: config.maxEscalationLevel,
      reEscalationHours: config.reEscalationHours,
      warningCooldownHours: config.warningCooldownHours,
      schedulerTimezone: config.schedulerTimezone,
    },
  };
};

/**
 * Get Escalation Statistics
 */
const getEscalationStats = async () => {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEscalated,
    escalatedLast24h,
    escalatedLast7d,
    byLevel,
    avgEscalationTime,
  ] = await Promise.all([
    Complaint.countDocuments({ status: "escalated" }),
    Complaint.countDocuments({ "timeline.escalatedAt": { $gte: last24Hours } }),
    Complaint.countDocuments({ "timeline.escalatedAt": { $gte: last7Days } }),
    Complaint.aggregate([
      { $match: { escalationLevel: { $gt: 0 } } },
      { $group: { _id: "$escalationLevel", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Complaint.aggregate([
      {
        $match: {
          "timeline.escalatedAt": { $exists: true },
          "timeline.submittedAt": { $exists: true },
        },
      },
      {
        $project: {
          escalationTime: {
            $divide: [
              { $subtract: ["$timeline.escalatedAt", "$timeline.submittedAt"] },
              3600000, // hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: "$escalationTime" },
        },
      },
    ]),
  ]);

  return {
    current: {
      totalEscalated,
      escalatedLast24h,
      escalatedLast7d,
    },
    byLevel: byLevel.reduce((acc, item) => {
      acc[`level${item._id}`] = item.count;
      return acc;
    }, {}),
    averageTimeToEscalation: avgEscalationTime[0]?.avgHours
      ? Math.round(avgEscalationTime[0].avgHours * 10) / 10
      : null,
  };
};

module.exports = {
  // Configuration
  config,

  // Core functions
  checkAndEscalateComplaints,
  sendDeadlineWarnings,
  generateDailySummary,
  reEscalateStaleComplaints,
  cleanupOldNotifications,

  // Scheduler control
  startScheduler,
  stopScheduler,
  runManualCheck,
  getSchedulerStatus,

  // Statistics
  getEscalationStats,
};
