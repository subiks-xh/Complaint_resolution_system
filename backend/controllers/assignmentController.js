const AssignmentRule = require("../models/AssignmentRule");
const AssignmentLog = require("../models/AssignmentLog");
const User = require("../models/User");
const Complaint = require("../models/Complaint");
const EscalationRule = require("../models/EscalationRule");
const Notification = require("../models/Notification");
const StaffAvailability = require("../models/StaffAvailability");
const {
  sendNewAssignmentEmail,
  sendComplaintStatusEmail,
} = require("../utils/sendEmail");

// Assignment Rule Management
exports.createAssignmentRule = async (req, res) => {
  try {
    const actorId = req.user.id || req.user._id;

    const ruleData = {
      ...req.body,
      organization: req.user.organization,
      createdBy: actorId,
    };

    const rule = new AssignmentRule(ruleData);
    await rule.save();

    res.status(201).json({
      success: true,
      message: "Assignment rule created successfully",
      data: rule,
    });
  } catch (error) {
    console.error("Create assignment rule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create assignment rule",
      error: error.message,
    });
  }
};

exports.getAssignmentRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, category, priority } = req.query;

    const filter = { organization: req.user.organization };
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (category) filter["conditions.categories"] = category;
    if (priority) filter["conditions.priorities"] = priority;

    const rules = await AssignmentRule.find(filter)
      .populate("conditions.categories", "name")
      .populate("createdBy", "name email")
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AssignmentRule.countDocuments(filter);

    res.json({
      success: true,
      data: {
        rules,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Get assignment rules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assignment rules",
      error: error.message,
    });
  }
};

exports.updateAssignmentRule = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await AssignmentRule.findOneAndUpdate(
      { _id: id, organization: req.user.organization },
      req.body,
      { new: true, runValidators: true },
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Assignment rule not found",
      });
    }

    res.json({
      success: true,
      message: "Assignment rule updated successfully",
      data: rule,
    });
  } catch (error) {
    console.error("Update assignment rule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update assignment rule",
      error: error.message,
    });
  }
};

exports.deleteAssignmentRule = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await AssignmentRule.findOneAndDelete({
      _id: id,
      organization: req.user.organization,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Assignment rule not found",
      });
    }

    res.json({
      success: true,
      message: "Assignment rule deleted successfully",
    });
  } catch (error) {
    console.error("Delete assignment rule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete assignment rule",
      error: error.message,
    });
  }
};

// Enhanced Assignment Logic
exports.assignComplaintWithRules = async (req, res) => {
  try {
    const { complaintId } = req.params;
    let { staffId, assignmentConfig } = req.body;
    const actorId = req.user.id || req.user._id;

    const complaint =
      await Complaint.findById(complaintId).populate("category");
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Get applicable assignment rules
    const applicableRules = await AssignmentRule.findApplicableRules(
      complaint,
      req.user.organization,
    );

    let assignmentRule = null;
    let assignmentMethod = "manual";

    // If no specific staff provided, use rules for auto-assignment
    if (!staffId && applicableRules.length > 0) {
      assignmentRule = applicableRules[0];
      assignmentMethod = assignmentRule.actions.assignmentMethod;

      // Find best staff based on assignment method
      const bestStaff = await findBestStaff(complaint, assignmentRule);
      if (!bestStaff) {
        return res.status(400).json({
          success: false,
          message: "No suitable staff available based on assignment rules",
        });
      }
      staffId = bestStaff._id;
    }

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required for assignment",
      });
    }

    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // Check staff workload
    const currentWorkload = await Complaint.countDocuments({
      assignedTo: staffId,
      status: { $nin: ["resolved", "closed"] },
    });

    if (currentWorkload >= staff.maxAssignedComplaints) {
      return res.status(400).json({
        success: false,
        message: "Staff member is at maximum capacity",
      });
    }

    // Create assignment log
    const assignmentLog = new AssignmentLog({
      complaint: complaintId,
      assignedTo: staffId,
      assignedBy: actorId,
      assignmentType: assignmentConfig?.assignmentType || "manual",
      assignmentMethod,
      configuration: assignmentConfig || {},
      context: {
        staffWorkloadBefore: currentWorkload,
        staffWorkloadAfter: currentWorkload + 1,
        ruleUsed: assignmentRule?._id,
      },
      organization: req.user.organization,
    });

    // Update complaint
    const updateData = {
      assignedTo: staffId,
      status: "assigned",
      assignedAt: new Date(),
      priority: assignmentConfig?.priority || complaint.priority,
    };

    if (assignmentConfig?.dueDate) {
      updateData.dueDate = new Date(assignmentConfig.dueDate);
    }

    await Complaint.findByIdAndUpdate(complaintId, updateData);
    await assignmentLog.save();

    // Update assignment rule usage
    if (assignmentRule) {
      await assignmentRule.updateUsage(
        Date.now() - assignmentLog.timing.assignmentProcessedAt,
      );
    }

    // Send notifications
    await sendAssignmentNotifications(
      complaint,
      staff,
      assignmentConfig,
      req.user,
    );

    res.json({
      success: true,
      message: "Complaint assigned successfully",
      data: {
        complaint: updateData,
        assignmentLog: assignmentLog._id,
        assignedStaff: {
          name:
            staff.name ||
            `${staff.firstName || ""} ${staff.lastName || ""}`.trim(),
          email: staff.email,
        },
      },
    });
  } catch (error) {
    console.error("Assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign complaint",
      error: error.message,
    });
  }
};

// Helper function to find best staff based on assignment method
async function findBestStaff(complaint, rule) {
  const baseQuery = {
    organization: complaint.organization,
    role: "staff",
    isActive: true,
  };

  // Add specialization filter if skill matching is enabled
  if (rule.conditions?.skillMatching?.enabled) {
    if (rule.conditions?.skillMatching?.strictMode) {
      baseQuery.specializations = { $in: [complaint.category._id] };
    }
  }

  const staff = await User.find(baseQuery);

  const availableStaffIds = await StaffAvailability.getAvailableStaffIds(
    complaint.organization,
    new Date(),
  );

  const filteredStaff = availableStaffIds.length
    ? staff.filter((member) =>
        availableStaffIds.includes(member._id.toString()),
      )
    : staff;

  if (filteredStaff.length === 0) return null;

  switch (rule.actions.assignmentMethod) {
    case "ai_based":
      return await findBestStaffWithAI(filteredStaff, complaint);

    case "least_loaded":
      return await findLeastLoadedStaff(filteredStaff);

    case "round_robin":
      return await findRoundRobinStaff(filteredStaff);

    case "performance_based":
      return await findBestPerformingStaff(filteredStaff);

    case "skill_based":
      return await findBestSkillMatch(filteredStaff, complaint);

    default:
      return filteredStaff[0];
  }
}

async function findBestStaffWithAI(staffList, complaint) {
  const scoredCandidates = await Promise.all(
    staffList.map(async (staff) => {
      const activeComplaints = await Complaint.countDocuments({
        assignedTo: staff._id,
        status: { $nin: ["resolved", "closed"] },
      });

      let performanceScore = 0;
      try {
        const metrics = await AssignmentLog.getStaffPerformanceMetrics(
          staff._id,
        );
        performanceScore =
          (metrics?.slaCompliance || 0) * 0.6 +
          (metrics?.acceptedAssignments || 0) * 0.4;
      } catch (error) {
        performanceScore = 0;
      }

      const categoryId = complaint?.category?._id || complaint?.category;
      const skillMatch =
        categoryId &&
        Array.isArray(staff.specializations) &&
        staff.specializations.some(
          (spec) => spec.toString() === categoryId.toString(),
        )
          ? 1
          : 0;

      const aiFallbackScore =
        skillMatch * 35 +
        Math.max(0, 25 - activeComplaints * 4) +
        performanceScore;

      return {
        staff,
        activeComplaints,
        skillMatch,
        performanceScore,
        aiFallbackScore,
      };
    }),
  );

  const fallbackSorted = scoredCandidates.sort(
    (a, b) => b.aiFallbackScore - a.aiFallbackScore,
  );
  const fallbackChoice = fallbackSorted[0]?.staff || staffList[0] || null;

  const aiEnabled = process.env.ASSIGNMENT_AI_ENABLED === "true";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!aiEnabled || !apiKey || fallbackSorted.length === 0) {
    return fallbackChoice;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const model = process.env.ASSIGNMENT_AI_MODEL || "gpt-4o-mini";
    const topCandidates = fallbackSorted.slice(0, 5).map((candidate) => ({
      staffId: candidate.staff._id.toString(),
      activeComplaints: candidate.activeComplaints,
      skillMatch: candidate.skillMatch,
      performanceScore: Math.round(candidate.performanceScore * 100) / 100,
      fallbackScore: Math.round(candidate.aiFallbackScore * 100) / 100,
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              'Select the single best staffId for complaint assignment. Reply only JSON like {"staffId":"..."}.',
          },
          {
            role: "user",
            content: JSON.stringify({
              complaint: {
                priority: complaint.priority,
                categoryId: complaint?.category?._id || complaint?.category,
              },
              candidates: topCandidates,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackChoice;
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    const selected = fallbackSorted.find(
      (candidate) => candidate.staff._id.toString() === parsed?.staffId,
    );

    return selected?.staff || fallbackChoice;
  } catch (error) {
    console.warn("AI assignment failed, using fallback:", error.message);
    return fallbackChoice;
  }
}

async function findLeastLoadedStaff(staffList) {
  const workloads = await Promise.all(
    staffList.map(async (staff) => {
      const activeComplaints = await Complaint.countDocuments({
        assignedTo: staff._id,
        status: { $nin: ["resolved", "closed"] },
      });
      return { staff, workload: activeComplaints };
    }),
  );

  workloads.sort((a, b) => a.workload - b.workload);
  return workloads[0]?.staff;
}

async function findRoundRobinStaff(staffList) {
  // Get last assignment for round robin
  const lastAssignment = await AssignmentLog.findOne({
    assignmentMethod: "round_robin",
  })
    .sort({ createdAt: -1 })
    .populate("assignedTo");

  if (!lastAssignment) return staffList[0];

  const lastIndex = staffList.findIndex(
    (s) => s._id.toString() === lastAssignment.assignedTo._id.toString(),
  );
  const nextIndex = (lastIndex + 1) % staffList.length;

  return staffList[nextIndex];
}

async function findBestPerformingStaff(staffList) {
  const performance = await Promise.all(
    staffList.map(async (staff) => {
      const metrics = await AssignmentLog.getStaffPerformanceMetrics(staff._id);
      return {
        staff,
        score:
          (metrics.slaCompliance || 0) * 0.4 +
          ((100 - (metrics.avgResponseTime || 0) / 3600) / 100) * 0.3 +
          ((metrics.acceptedAssignments || 0) /
            (metrics.totalAssignments || 1)) *
            0.3,
      };
    }),
  );

  performance.sort((a, b) => b.score - a.score);
  return performance[0]?.staff;
}

async function findBestSkillMatch(staffList, complaint) {
  // Find staff with best specialization match
  const skillMatches = staffList.filter(
    (staff) =>
      staff.specializations &&
      staff.specializations.some(
        (spec) => spec.toString() === complaint.category._id.toString(),
      ),
  );

  return skillMatches[0] || staffList[0];
}

// Send notifications for assignment
async function sendAssignmentNotifications(
  complaint,
  staff,
  config,
  assignedBy,
) {
  const staffDisplayName =
    staff.name || `${staff.firstName || ""} ${staff.lastName || ""}`.trim();
  const notifications = [];
  const senderId = assignedBy?.id || assignedBy?._id || null;

  // Notify assignee
  if (config?.notifyAssignee !== false) {
    notifications.push({
      recipient: staff._id,
      sender: senderId,
      type: "new_assignment",
      title: "New Complaint Assigned",
      message: `You have been assigned complaint #${complaint.complaintId}: ${complaint.title}`,
      relatedComplaint: complaint._id,
      metadata: { complaintId: complaint._id },
    });
  }

  // Notify user if requested
  if (config?.notifyUser) {
    notifications.push({
      recipient: complaint.user,
      sender: senderId,
      type: "complaint_assigned",
      title: "Complaint Assigned",
      message: `Your complaint has been assigned to ${staffDisplayName}`,
      relatedComplaint: complaint._id,
      metadata: { complaintId: complaint._id },
    });
  }

  // Create notifications
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  try {
    const [assigneeWithEmail, complaintUser] = await Promise.all([
      User.findById(staff._id).select("name email"),
      User.findById(complaint.user).select("name email"),
    ]);

    if (assigneeWithEmail?.email) {
      await sendNewAssignmentEmail(
        assigneeWithEmail,
        complaint,
        config?.dueDate,
      );
    }

    if (config?.notifyUser && complaintUser?.email) {
      await sendComplaintStatusEmail(
        complaintUser,
        complaint,
        "Assigned",
        `Assigned to ${staffDisplayName}`,
      );
    }
  } catch (error) {
    console.warn("Assignment email notification failed:", error.message);
  }
}

// Get SLA information
exports.getSLAInfo = async (req, res) => {
  try {
    const { category, priority = "medium" } = req.query;

    // Get escalation rules for this category/priority
    const escalationRules = await EscalationRule.find({
      organization: req.user.organization,
      "conditions.categories": category,
      "conditions.priorities": priority,
      isActive: true,
    }).sort({ priority: -1 });

    let slaInfo = {
      timeLimit: 24, // default 24 hours
      responseTime: 4, // default 4 hours
      escalationEnabled: true,
    };

    if (escalationRules.length > 0) {
      const rule = escalationRules[0];
      slaInfo = {
        timeLimit: rule.conditions.timeThreshold || 24,
        responseTime: rule.conditions.responseThreshold || 4,
        escalationEnabled: rule.isActive,
      };
    }

    res.json({
      success: true,
      data: slaInfo,
    });
  } catch (error) {
    console.error("Get SLA info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch SLA information",
      error: error.message,
    });
  }
};

// Get assignment analytics
exports.getAssignmentAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;

    const dateRange = {};
    if (startDate) dateRange.startDate = new Date(startDate);
    if (endDate) dateRange.endDate = new Date(endDate);

    if (staffId) {
      const staffMetrics = await AssignmentLog.getStaffPerformanceMetrics(
        staffId,
        dateRange,
      );
      return res.json({
        success: true,
        data: { staffMetrics },
      });
    }

    const organizationAnalytics = await AssignmentLog.getAssignmentAnalytics(
      req.user.organization,
      dateRange,
    );

    res.json({
      success: true,
      data: { analytics: organizationAnalytics },
    });
  } catch (error) {
    console.error("Get assignment analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assignment analytics",
      error: error.message,
    });
  }
};

module.exports = exports;
