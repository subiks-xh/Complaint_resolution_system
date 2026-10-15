/**
 * Unified Escalation Engine Service
 *
 * Core service evaluating SLA deadlines and configured EscalationRule models:
 * - Tenant-isolated rule evaluation and automatic SLA breach detection
 * - Concurrency control via in-memory lock
 * - Idempotent escalation step processing
 * - Robust notification and audit trail integration
 */

const Complaint = require("../models/Complaint");
const EscalationRule = require("../models/EscalationRule");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEscalationAlertEmail } = require("./sendEmail");
const notificationService = require("../services/notificationService");

// Concurrency lock to prevent overlapping runs within the process
let isRunning = false;

/**
 * Get tenant administrators and super admins for notification delivery
 */
const getAdminRecipients = async (organizationId) => {
  const query = {
    role: { $in: ["admin", "org_admin", "super_admin"] },
    isActive: true,
  };

  if (organizationId) {
    query.$or = [{ organization: organizationId }, { role: "super_admin" }];
  } else {
    query.role = "super_admin";
  }

  return User.find(query).select("_id name email organization role");
};

/**
 * Evaluate configured EscalationRule criteria against an active complaint.
 * Supports explicit 'now' parameter for deterministic testing.
 */
const evaluateRuleConditions = (rule, complaint, now = new Date()) => {
  const effectiveCreation =
    complaint.status === "reopened" && complaint.timeline?.reopenedAt
      ? new Date(complaint.timeline.reopenedAt)
      : new Date(complaint.timeline?.submittedAt || complaint.createdAt);

  const lastUpdate = new Date(
    complaint.timeline?.lastUpdatedAt ||
      complaint.updatedAt ||
      complaint.timeline?.submittedAt ||
      complaint.createdAt,
  );

  const hoursTotal = (now.getTime() - effectiveCreation.getTime()) / (1000 * 60 * 60);
  const hoursSinceUpdate =
    (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

  const reasons = [];

  // 1. Time threshold from creation
  if (
    rule.conditions?.timeThreshold &&
    hoursTotal >= rule.conditions.timeThreshold
  ) {
    reasons.push(
      `Total age threshold exceeded (${Math.floor(hoursTotal)}h >= ${rule.conditions.timeThreshold}h)`,
    );
  }

  // 2. Response threshold for unassigned/new complaints
  if (
    complaint.status === "new" &&
    rule.conditions?.responseThreshold &&
    hoursTotal >= rule.conditions.responseThreshold
  ) {
    reasons.push(
      `First response threshold exceeded (${Math.floor(hoursTotal)}h >= ${rule.conditions.responseThreshold}h)`,
    );
  }

  // 3. Inactivity / No update threshold for in-progress / assigned complaints
  if (
    rule.conditions?.noUpdateThreshold &&
    hoursSinceUpdate >= rule.conditions.noUpdateThreshold
  ) {
    reasons.push(
      `No update threshold exceeded (${Math.floor(hoursSinceUpdate)}h >= ${rule.conditions.noUpdateThreshold}h)`,
    );
  }

  return {
    matched: reasons.length > 0,
    reasons,
  };
};

/**
 * Execute automatic escalation on a single complaint.
 * Enforces idempotency: will not double-escalate at the same level or re-send duplicate notifications.
 */
const executeEscalation = async (complaint, options = {}) => {
  const {
    reason = "Automatic escalation triggered",
    rule = null,
    now = new Date(),
  } = options;

  // Terminal or invalid statuses cannot be escalated
  if (["resolved", "closed"].includes(complaint.status)) {
    return { executed: false, reason: "Complaint is already resolved or closed" };
  }

  const maxEscalationLevel = 5;
  if ((complaint.escalationLevel || 0) >= maxEscalationLevel) {
    return { executed: false, reason: "Maximum escalation level reached" };
  }

  const nextLevel = (complaint.escalationLevel || 0) + 1;

  // Idempotency: verify this specific escalation level hasn't already been recorded recently,
  // or that an identical rule/step hasn't already executed for this level within 60 minutes.
  const recentEscalation = (complaint.escalationHistory || []).find((h) => {
    if (!h.escalatedAt) return false;
    const diff = (now.getTime() - new Date(h.escalatedAt).getTime()) / (1000 * 60);
    // If escalated to the same level within 60 minutes for this reason or step, suppress duplicate retry
    const sameLevel = h.escalationLevel === nextLevel || h.escalationLevel === complaint.escalationLevel;
    const sameReason = h.reason === reason;
    return diff < 60 && sameLevel && sameReason;
  });

  if (recentEscalation) {
    return {
      executed: false,
      reason: "Recent identical escalation already recorded (idempotency guard)",
    };
  }

  const previousAssignee = complaint.assignedTo?._id || complaint.assignedTo || null;
  let newAssignee = previousAssignee;

  // Rule action: auto-assign to available staff in the same organization
  if (rule?.actions?.autoAssign) {
    try {
      const availableStaff = await User.findAvailableStaff(
        complaint.organization,
        complaint.category?._id || complaint.category || null,
      );

      // Filter out current assignee if another staff is available
      const alternativeStaff = availableStaff.filter(
        (s) => s._id.toString() !== (previousAssignee ? previousAssignee.toString() : ""),
      );

      if (alternativeStaff.length > 0) {
        newAssignee = alternativeStaff[0]._id;
      }
    } catch (assignErr) {
      console.warn("Auto-assignment suggestion error during escalation:", assignErr.message);
    }
  }

  // Rule action: increase priority
  if (rule?.actions?.increasePriority) {
    if (complaint.priority === "low") complaint.priority = "medium";
    else if (complaint.priority === "medium") complaint.priority = "high";
    else if (complaint.priority === "high") complaint.priority = "critical";
  }

  // Update complaint state
  complaint.escalationLevel = nextLevel;
  complaint.status = "escalated";
  complaint.timeline = complaint.timeline || {};
  complaint.timeline.escalatedAt = now;
  complaint.timeline.lastUpdatedAt = now;
  if (newAssignee && newAssignee !== previousAssignee) {
    complaint.assignedTo = newAssignee;
    complaint.timeline.assignedAt = now;
  }

  // Record in escalationHistory
  complaint.escalationHistory = complaint.escalationHistory || [];
  complaint.escalationHistory.push({
    escalatedAt: now,
    escalationLevel: nextLevel,
    reason,
    escalationType: "auto",
    previousAssignee,
    reassignedTo: newAssignee !== previousAssignee ? newAssignee : null,
  });

  // Record in statusHistory
  complaint.statusHistory = complaint.statusHistory || [];
  complaint.statusHistory.push({
    status: "escalated",
    changedBy: null, // System automated action
    changedByRole: "system",
    remarks: reason,
    changedAt: now,
  });

  await complaint.save();

  // Update rule execution stats if applicable
  if (rule?._id) {
    try {
      await EscalationRule.findByIdAndUpdate(rule._id, {
        $inc: { "stats.totalExecutions": 1, "stats.totalEscalated": 1 },
        $set: { "stats.lastExecuted": now },
      });
    } catch (statErr) {
      console.warn("Could not update EscalationRule stats:", statErr.message);
    }
  }

  // Send notifications safely (failures do not rollback the mutation)
  const notificationPromises = [];
  try {
    const admins = await getAdminRecipients(complaint.organization);

    for (const admin of admins) {
      notificationPromises.push(
        notificationService.sendInAppNotification({
          recipient: admin._id,
          recipientUser: admin,
          type: "complaint_escalated",
          title: `Complaint Escalated (Level ${nextLevel})`,
          message: `Complaint "${complaint.complaintId}" escalated: ${reason}`,
          priority: "urgent",
          relatedComplaint: complaint._id,
          actionUrl: `/admin/complaints/${complaint._id}`,
          metadata: {
            complaintId: complaint.complaintId,
            escalationLevel: nextLevel,
            reason,
          },
        }),
      );

      // Email alert for high/critical or SLA breaches, checking admin preference
      notificationPromises.push(
        notificationService.sendUserEmail(admin, "escalationAlerts", () =>
          sendEscalationAlertEmail(admin, complaint, reason, nextLevel),
        ),
      );
    }

    // Notify assigned staff
    if (complaint.assignedTo) {
      notificationPromises.push(
        notificationService.sendInAppNotification({
          recipient: complaint.assignedTo._id || complaint.assignedTo,
          type: "complaint_escalated",
          title: "Assigned Complaint Escalated",
          message: `Complaint "${complaint.complaintId}" assigned to you has been escalated to Level ${nextLevel}.`,
          priority: "urgent",
          relatedComplaint: complaint._id,
          actionUrl: `/staff/complaints/${complaint._id}`,
        }),
      );
    }

    // Notify submitting user
    if (complaint.user) {
      notificationPromises.push(
        notificationService.sendInAppNotification({
          recipient: complaint.user._id || complaint.user,
          type: "complaint_escalated",
          title: "Complaint Escalated",
          message: `Your complaint "${complaint.complaintId}" has been escalated for priority handling.`,
          priority: "high",
          relatedComplaint: complaint._id,
          actionUrl: `/complaints/${complaint._id}`,
        }),
      );
    }

    await Promise.allSettled(notificationPromises);
  } catch (notifErr) {
    console.error("Error dispatching escalation notifications:", notifErr);
  }

  return {
    executed: true,
    complaintId: complaint.complaintId,
    escalationLevel: nextLevel,
    reassignedTo: newAssignee !== previousAssignee ? newAssignee : null,
  };
};

/**
 * Main Rule Evaluation & SLA Escalation Engine
 * Evaluates active EscalationRule configurations and raw SLA deadlines.
 * Can be run tenant-scoped or globally.
 */
const runEscalationCycle = async (options = {}) => {
  const { organizationId = null, now = new Date() } = options;

  if (isRunning) {
    console.log("⚠️ Escalation cycle already in progress. Skipping overlapping run.");
    return { skipped: true, reason: "Concurrent execution in progress" };
  }

  isRunning = true;
  const results = {
    processedCount: 0,
    escalatedCount: 0,
    rulesEvaluated: 0,
    slaBreachedCount: 0,
    errors: [],
  };

  try {
    // -------------------------------------------------------------
    // PHASE A: Process Configured EscalationRule Definitions
    // -------------------------------------------------------------
    const ruleFilter = { isActive: true };
    if (organizationId) {
      ruleFilter.organization = organizationId;
    }

    const activeRules = await EscalationRule.find(ruleFilter).sort({ createdAt: 1 });
    results.rulesEvaluated = activeRules.length;

    for (const rule of activeRules) {
      // Find open complaints matching the rule's criteria
      const complaintQuery = {
        organization: rule.organization,
        status: { $in: ["new", "assigned", "in-progress", "reopened"] },
        priority: rule.priority,
      };

      if (rule.category) {
        complaintQuery.category = rule.category;
      }

      const matchingComplaints = await Complaint.find(complaintQuery).populate(
        "assignedTo user category",
      );

      for (const complaint of matchingComplaints) {
        results.processedCount++;
        try {
          const evalResult = evaluateRuleConditions(rule, complaint, now);
          if (evalResult.matched) {
            const reason = `[EscalationRule: ${rule.name}] ${evalResult.reasons.join("; ")}`;
            const execRes = await executeEscalation(complaint, {
              reason,
              rule,
              now,
            });
            if (execRes.executed) {
              results.escalatedCount++;
            }
          }
        } catch (itemErr) {
          console.error(`Error processing complaint ${complaint.complaintId} against rule ${rule.name}:`, itemErr);
          results.errors.push({ complaintId: complaint.complaintId, error: itemErr.message });
        }
      }
    }

    // -------------------------------------------------------------
    // PHASE B: Process SLA Deadline Breaches (Default Category Fallback)
    // -------------------------------------------------------------
    const slaQuery = {
      status: { $in: ["new", "assigned", "in-progress", "reopened"] },
      resolutionDeadline: { $lt: now },
    };

    if (organizationId) {
      slaQuery.organization = organizationId;
    }

    const breachedComplaints = await Complaint.find(slaQuery).populate(
      "assignedTo user category",
    );

    for (const complaint of breachedComplaints) {
      results.processedCount++;
      try {
        complaint.slaBreached = true;
        results.slaBreachedCount++;

        const autoEscalate =
          complaint.category?.escalationConfig?.autoEscalate !== false;

        if (autoEscalate) {
          const reason = "SLA resolution deadline breached - automatic escalation";
          const execRes = await executeEscalation(complaint, { reason, now });
          if (execRes.executed) {
            results.escalatedCount++;
          }
        } else {
          // If autoEscalate is disabled on the category, persist slaBreached flag
          await Complaint.findByIdAndUpdate(complaint._id, {
            $set: { slaBreached: true },
          });
        }
      } catch (slaErr) {
        console.error(`Error processing SLA breach for complaint ${complaint.complaintId}:`, slaErr);
        results.errors.push({ complaintId: complaint.complaintId, error: slaErr.message });
      }
    }

    return results;
  } finally {
    isRunning = false;
  }
};

module.exports = {
  runEscalationCycle,
  executeEscalation,
  evaluateRuleConditions,
  getAdminRecipients,
  isCycleRunning: () => isRunning,
};
