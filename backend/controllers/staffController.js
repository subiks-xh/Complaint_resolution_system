/**
 * Staff Controller
 *
 * Handles staff-specific operations:
 * - View assigned complaints
 * - Update complaint status
 * - Add resolution details
 * - Manage workload
 * - Staff dashboard
 * - Internal notes management
 * - Request reassignment
 */

const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Feedback = require("../models/Feedback");
const Notification = require("../models/Notification");
const Category = require("../models/Category");
const Payment = require("../models/Payment");
const {
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
} = require("../config/cloudinary");
const mongoose = require("mongoose");
const { sendComplaintStatusEmail, sendEmail } = require("../utils/sendEmail");

const getCurrentWorkedSeconds = (complaint) => {
  const base = complaint?.workTracking?.totalSeconds || 0;
  const startedAt = complaint?.workTracking?.activeSessionStartedAt;
  if (!startedAt) {
    return Math.max(0, Math.floor(base));
  }
  const liveSeconds = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  return Math.max(0, Math.floor(base + liveSeconds));
};

/**
 * @desc    Get staff dashboard data
 * @route   GET /api/staff/dashboard
 * @access  Private/Staff
 */
const getDashboard = async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get comprehensive dashboard data with parallel queries
    const [
      complaintStats,
      recentComplaints,
      urgentComplaints,
      feedbackStats,
      performanceData,
      weeklyTrend,
      categoryDistribution,
      staffInfo,
    ] = await Promise.all([
      // Complaint statistics by status
      Complaint.aggregate([
        {
          $match: { assignedTo: staffId, organization: req.user.organization },
        },
        {
          $facet: {
            byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            byPriority: [
              {
                $match: { status: { $nin: ["resolved", "closed"] } },
              },
              { $group: { _id: "$priority", count: { $sum: 1 } } },
            ],
            total: [{ $count: "count" }],
            active: [
              {
                $match: {
                  status: {
                    $in: ["assigned", "in-progress", "reopened", "escalated"],
                  },
                },
              },
              { $count: "count" },
            ],
            overdue: [
              {
                $match: {
                  status: { $nin: ["resolved", "closed"] },
                  resolutionDeadline: { $lt: now },
                },
              },
              { $count: "count" },
            ],
            slaBreached: [
              { $match: { slaBreached: true } },
              { $count: "count" },
            ],
            resolvedThisMonth: [
              {
                $match: {
                  status: { $in: ["resolved", "closed"] },
                  "timeline.resolvedAt": { $gte: startOfMonth },
                },
              },
              { $count: "count" },
            ],
            resolvedThisWeek: [
              {
                $match: {
                  status: { $in: ["resolved", "closed"] },
                  "timeline.resolvedAt": { $gte: startOfWeek },
                },
              },
              { $count: "count" },
            ],
            escalated: [
              { $match: { status: "escalated" } },
              { $count: "count" },
            ],
          },
        },
      ]),

      // Recent assigned complaints (active ones)
      Complaint.find({
        assignedTo: staffId,
        organization: req.user.organization,
        status: { $in: ["assigned", "in-progress", "reopened", "escalated"] },
      })
        .populate("user", "name email avatar")
        .populate("category", "name color icon")
        .sort({ priority: -1, createdAt: -1 })
        .limit(5)
        .lean(),

      // Urgent/overdue complaints requiring immediate attention
      Complaint.find({
        assignedTo: staffId,
        organization: req.user.organization,
        status: { $nin: ["resolved", "closed"] },
        $or: [
          { priority: { $in: ["high", "critical"] } },
          { resolutionDeadline: { $lt: now } },
          { status: "escalated" },
        ],
      })
        .populate("user", "name email phone")
        .populate("category", "name color icon")
        .sort({
          status: 1, // escalated first
          priority: -1,
          resolutionDeadline: 1,
        })
        .limit(10)
        .lean(),

      // Feedback statistics
      Feedback.getStaffStats(req.user.id),

      // Performance data (resolution times over months)
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            organization: req.user.organization,
            "timeline.resolvedAt": { $exists: true },
            "timeline.assignedAt": { $exists: true },
          },
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ["$timeline.resolvedAt", "$timeline.assignedAt"] },
                3600000, // Convert to hours
              ],
            },
            month: {
              $dateToString: { format: "%Y-%m", date: "$timeline.resolvedAt" },
            },
            slaBreached: 1,
          },
        },
        {
          $group: {
            _id: "$month",
            avgResolutionTime: { $avg: "$resolutionTime" },
            minResolutionTime: { $min: "$resolutionTime" },
            maxResolutionTime: { $max: "$resolutionTime" },
            count: { $sum: 1 },
            slaBreachedCount: { $sum: { $cond: ["$slaBreached", 1, 0] } },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
      ]),

      // Weekly trend (complaints per day for last 7 days)
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            organization: req.user.organization,
            createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            assigned: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Category distribution for active complaints
      Complaint.aggregate([
        {
          $match: {
            organization: req.user.organization,
            assignedTo: staffId,
            status: { $nin: ["resolved", "closed"] },
          },
        },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        { $unwind: "$categoryInfo" },
        {
          $project: {
            name: "$categoryInfo.name",
            color: "$categoryInfo.color",
            icon: "$categoryInfo.icon",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Staff user info for capacity
      User.findById(req.user.id)
        .select(
          "name email department designation maxAssignedComplaints specializations avatar",
        )
        .populate("specializations", "name color"),
    ]);

    const stats = complaintStats[0];

    // Calculate capacity
    const activeCount = stats.active[0]?.count || 0;
    const maxCapacity = staffInfo?.maxAssignedComplaints || 10;
    const availableCapacity = Math.max(0, maxCapacity - activeCount);
    const capacityPercentage = Math.round((activeCount / maxCapacity) * 100);

    // Format urgent complaints with additional info
    const formattedUrgentComplaints = urgentComplaints.map((c) => {
      const deadline = c.resolutionDeadline
        ? new Date(c.resolutionDeadline)
        : null;
      const isOverdue = deadline && now > deadline;
      const hoursRemaining = deadline
        ? Math.floor((deadline - now) / 3600000)
        : null;

      return {
        ...c,
        isOverdue,
        hoursRemaining,
        urgencyReason:
          c.status === "escalated"
            ? "Escalated"
            : isOverdue
              ? "Overdue"
              : c.priority === "critical"
                ? "Critical Priority"
                : "High Priority",
      };
    });

    // Format recent complaints
    const formattedRecentComplaints = recentComplaints.map((c) => ({
      ...c,
      isOverdue: c.resolutionDeadline && now > new Date(c.resolutionDeadline),
      hoursRemaining: c.resolutionDeadline
        ? Math.floor((new Date(c.resolutionDeadline) - now) / 3600000)
        : null,
    }));

    // Build response
    const dashboard = {
      staff: {
        id: staffInfo?._id,
        name: staffInfo?.name,
        email: staffInfo?.email,
        department: staffInfo?.department,
        designation: staffInfo?.designation,
        avatar: staffInfo?.avatar?.url,
        specializations: staffInfo?.specializations || [],
      },
      overview: {
        total: stats.total[0]?.count || 0,
        active: activeCount,
        overdue: stats.overdue[0]?.count || 0,
        escalated: stats.escalated[0]?.count || 0,
        slaBreached: stats.slaBreached[0]?.count || 0,
        resolvedThisMonth: stats.resolvedThisMonth[0]?.count || 0,
        resolvedThisWeek: stats.resolvedThisWeek[0]?.count || 0,
        capacity: {
          current: activeCount,
          max: maxCapacity,
          available: availableCapacity,
          percentage: capacityPercentage,
          status:
            capacityPercentage >= 90
              ? "full"
              : capacityPercentage >= 70
                ? "high"
                : capacityPercentage >= 50
                  ? "moderate"
                  : "available",
        },
      },
      byStatus: stats.byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: stats.byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentComplaints: formattedRecentComplaints,
      urgentComplaints: formattedUrgentComplaints,
      categoryDistribution,
      feedback: {
        ...feedbackStats,
        averageRating: Math.round((feedbackStats.averageRating || 0) * 10) / 10,
      },
      performanceTrend: performanceData.reverse().map((p) => ({
        ...p,
        avgResolutionTime: Math.round(p.avgResolutionTime * 10) / 10,
        slaComplianceRate:
          p.count > 0
            ? Math.round(((p.count - p.slaBreachedCount) / p.count) * 100)
            : 100,
      })),
      weeklyTrend,
    };

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Get staff dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get all complaints assigned to staff
 * @route   GET /api/staff/complaints
 * @access  Private/Staff
 */
const getAssignedComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      search,
      sortBy = "priority",
      sortOrder = "desc",
      overdue,
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {
      assignedTo: req.user.id,
      organization: req.user.organization,
      isArchived: false,
    };

    // Status filter
    if (status) {
      if (status === "active") {
        query.status = {
          $in: ["assigned", "in-progress", "reopened", "escalated"],
        };
      } else if (status.includes(",")) {
        query.status = { $in: status.split(",").map((s) => s.trim()) };
      } else {
        query.status = status;
      }
    }

    // Priority filter
    if (priority) {
      if (priority.includes(",")) {
        query.priority = { $in: priority.split(",").map((p) => p.trim()) };
      } else {
        query.priority = priority;
      }
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Date range filter
    if (startDate || endDate) {
      query["timeline.assignedAt"] = {};
      if (startDate) {
        query["timeline.assignedAt"].$gte = new Date(startDate);
      }
      if (endDate) {
        query["timeline.assignedAt"].$lte = new Date(endDate);
      }
    }

    // Overdue filter
    if (overdue === "true") {
      query.resolutionDeadline = { $lt: new Date() };
      query.status = { $nin: ["resolved", "closed"] };
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { complaintId: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
      ];
    }

    // Build sort - custom priority ordering
    let sort = {};
    if (sortBy === "priority") {
      // Custom sort: critical > high > medium > low
      sort = { priority: sortOrder === "asc" ? 1 : -1 };
    } else if (sortBy === "deadline") {
      sort = { resolutionDeadline: sortOrder === "asc" ? 1 : -1 };
    } else {
      const validSortFields = ["createdAt", "updatedAt", "status", "title"];
      if (validSortFields.includes(sortBy)) {
        sort[sortBy] = sortOrder === "asc" ? 1 : -1;
      } else {
        sort.createdAt = -1;
      }
    }

    // Always add secondary sort for consistency
    if (!sort.createdAt) {
      sort.createdAt = -1;
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [complaints, total, statusCounts] = await Promise.all([
      Complaint.find(query)
        .populate("user", "name email phone avatar department")
        .populate("category", "name color icon resolutionSLA")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Complaint.countDocuments(query),
      // Get counts for quick filters
      Complaint.aggregate([
        {
          $match: {
            assignedTo: new mongoose.Types.ObjectId(req.user.id),
            organization: req.user.organization,
            isArchived: false,
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    // Add computed fields
    const now = new Date();
    const complaintsWithExtras = complaints.map((complaint) => {
      const deadline = complaint.resolutionDeadline
        ? new Date(complaint.resolutionDeadline)
        : null;
      const isOverdue =
        deadline &&
        now > deadline &&
        !["resolved", "closed"].includes(complaint.status);
      const hoursRemaining = deadline
        ? Math.floor((deadline - now) / 3600000)
        : null;
      const ageInHours = Math.floor(
        (now - new Date(complaint.createdAt)) / 3600000,
      );

      // Determine urgency level
      let urgencyLevel = "normal";
      if (complaint.status === "escalated") {
        urgencyLevel = "critical";
      } else if (isOverdue) {
        urgencyLevel = "overdue";
      } else if (complaint.priority === "critical") {
        urgencyLevel = "critical";
      } else if (
        complaint.priority === "high" ||
        (hoursRemaining !== null && hoursRemaining < 4)
      ) {
        urgencyLevel = "high";
      } else if (hoursRemaining !== null && hoursRemaining < 12) {
        urgencyLevel = "medium";
      }

      return {
        ...complaint,
        isOverdue,
        hoursRemaining,
        ageInHours,
        ageInDays: Math.floor(ageInHours / 24),
        urgencyLevel,
        deadlineStatus: isOverdue
          ? "overdue"
          : hoursRemaining !== null && hoursRemaining < 4
            ? "critical"
            : hoursRemaining !== null && hoursRemaining < 12
              ? "warning"
              : "normal",
        workTracking: {
          ...(complaint.workTracking || {}),
          currentWorkedSeconds: getCurrentWorkedSeconds(complaint),
          isActive: !!complaint?.workTracking?.activeSessionStartedAt,
        },
      };
    });

    // Format status counts
    const statusCountsMap = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        complaints: complaintsWithExtras,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: skip + complaints.length < total,
          hasPrevPage: pageNum > 1,
        },
        filters: {
          statusCounts: statusCountsMap,
          activeFilters: {
            status,
            priority,
            category,
            overdue,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get assigned complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching assigned complaints",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get single complaint details (staff view)
 * @route   GET /api/staff/complaints/:id
 * @access  Private/Staff
 */
const getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Find by _id or complaintId
    let complaint;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!complaint) {
      complaint = await Complaint.findOne({
        complaintId: id.toUpperCase(),
        organization: req.user.organization,
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check if assigned to this staff member or if staff is admin
    const isAssigned = complaint.assignedTo?.toString() === req.user.id;

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Populate all necessary fields
    await complaint.populate([
      {
        path: "user",
        select: "name email phone avatar department designation",
      },
      { path: "assignedBy", select: "name email" },
      {
        path: "category",
        select: "name color icon description resolutionSLA escalationConfig",
      },
      {
        path: "feedback",
        select:
          "rating comments satisfactionLevel ratingBreakdown positiveAspects improvementAreas createdAt",
      },
      { path: "statusHistory.changedBy", select: "name role avatar" },
      { path: "escalationHistory.escalatedBy", select: "name" },
      { path: "escalationHistory.previousAssignee", select: "name email" },
      { path: "escalationHistory.reassignedTo", select: "name email" },
      { path: "internalNotes.addedBy", select: "name role avatar" },
      { path: "resolution.resolvedBy", select: "name email" },
    ]);

    // Build response with computed fields
    const now = new Date();
    const responseData = complaint.toObject();

    // Add computed fields
    responseData.isOverdue = complaint.isOverdue;
    responseData.ageInDays = complaint.ageInDays;
    responseData.ageInHours = complaint.ageInHours;
    responseData.timeRemaining = complaint.timeRemaining;

    const deadline = complaint.resolutionDeadline
      ? new Date(complaint.resolutionDeadline)
      : null;
    responseData.hoursRemaining = deadline
      ? Math.floor((deadline - now) / 3600000)
      : null;
    responseData.minutesRemaining = deadline
      ? Math.floor((deadline - now) / 60000)
      : null;

    // SLA information
    if (complaint.category?.resolutionSLA) {
      responseData.slaInfo = {
        targetHours: complaint.category.resolutionSLA[complaint.priority] || 48,
        deadline: complaint.resolutionDeadline,
        isBreached: complaint.slaBreached,
        status: complaint.slaBreached
          ? "breached"
          : responseData.hoursRemaining !== null &&
              responseData.hoursRemaining < 0
            ? "breached"
            : responseData.hoursRemaining !== null &&
                responseData.hoursRemaining < 4
              ? "critical"
              : responseData.hoursRemaining !== null &&
                  responseData.hoursRemaining < 12
                ? "warning"
                : "on-track",
      };
    }

    // Add action flags
    responseData.actions = {
      canUpdateStatus: !["closed"].includes(complaint.status),
      canStartWork: complaint.status === "assigned",
      canResolve: ["assigned", "in-progress", "reopened", "escalated"].includes(
        complaint.status,
      ),
      canAddNotes: true,
      canAddEvidence: [
        "assigned",
        "in-progress",
        "reopened",
        "escalated",
      ].includes(complaint.status),
      canRequestReassignment: !["resolved", "closed"].includes(
        complaint.status,
      ),
    };

    responseData.workTracking = {
      ...(responseData.workTracking || {}),
      currentWorkedSeconds: getCurrentWorkedSeconds(responseData),
      isActive: !!responseData?.workTracking?.activeSessionStartedAt,
    };

    // Get similar complaints (for reference)
    const similarComplaints = await Complaint.find({
      category: complaint.category._id,
      status: { $in: ["resolved", "closed"] },
      _id: { $ne: complaint._id },
      assignedTo: req.user.id,
    })
      .select("complaintId title resolution.remarks timeline.resolvedAt")
      .sort({ "timeline.resolvedAt": -1 })
      .limit(3)
      .lean();

    responseData.similarResolved = similarComplaints;

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get complaint details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching complaint details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update complaint status
 * @route   PUT /api/staff/complaints/:id/status
 * @access  Private/Staff
 */
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    // Validate status
    const allowedStatuses = ["in-progress", "resolved"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
      });
    }

    // Validate remarks for resolution
    if (status === "resolved") {
      if (!remarks || remarks.trim().length < 20) {
        return res.status(400).json({
          success: false,
          message:
            "Resolution remarks are required (at least 20 characters) to explain how the issue was resolved",
        });
      }
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Verify complaint can be updated
    if (["closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update a closed complaint",
      });
    }

    // Validate status transition
    const validTransitions = {
      assigned: ["in-progress", "resolved"],
      "in-progress": ["in-progress", "resolved"],
      reopened: ["in-progress", "resolved"],
      escalated: ["in-progress", "resolved"],
    };

    if (!validTransitions[complaint.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${complaint.status}" to "${status}"`,
      });
    }

    const previousStatus = complaint.status;
    const now = new Date();

    if (
      status === "resolved" &&
      complaint?.workTracking?.activeSessionStartedAt
    ) {
      const elapsed = Math.floor(
        (now.getTime() -
          new Date(complaint.workTracking.activeSessionStartedAt).getTime()) /
          1000,
      );
      complaint.workTracking.totalSeconds =
        (complaint.workTracking.totalSeconds || 0) + Math.max(0, elapsed);
      complaint.workTracking.lastPausedAt = now;
      complaint.workTracking.activeSessionStartedAt = null;
      complaint.workTracking.updatedBy = req.user.id;
      complaint.workTracking.logs.push({
        action: "pause",
        at: now,
        by: req.user.id,
        totalSecondsAfterAction: complaint.workTracking.totalSeconds,
      });
    }

    // Update status and timeline
    complaint.status = status;
    complaint.timeline.lastUpdatedAt = now;

    // Handle specific status transitions
    if (status === "in-progress") {
      if (!complaint.timeline.firstResponseAt) {
        complaint.timeline.firstResponseAt = now;
      }
    }

    if (status === "resolved") {
      complaint.timeline.resolvedAt = now;

      // Check if resolved within SLA
      if (complaint.resolutionDeadline && now <= complaint.resolutionDeadline) {
        complaint.slaBreached = false;
      }

      complaint.resolution = {
        remarks: remarks.trim(),
        resolvedBy: req.user.id,
        evidence: complaint.resolution?.evidence || [],
        satisfaction: "pending",
      };
    }

    // Add to status history
    complaint.statusHistory.push({
      status,
      changedBy: req.user.id,
      changedByRole: "staff",
      remarks:
        status === "resolved"
          ? `Resolved: ${remarks.trim()}`
          : remarks?.trim() || `Started working on the complaint`,
      changedAt: now,
    });

    await complaint.save();

    // Get staff info for notifications
    const staffUser = await User.findById(req.user.id).select("name");

    // Send notifications
    if (status === "in-progress") {
      await Notification.createFromTemplate({
        type: "status_change",
        recipient: complaint.user,
        sender: req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
          previousStatus,
          newStatus: status,
          staffName: staffUser.name,
          message: `${staffUser.name} has started working on your complaint.`,
        },
      });
    } else if (status === "resolved") {
      await Notification.createFromTemplate({
        type: "complaint_resolved",
        recipient: complaint.user,
        sender: req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
          remarks: remarks.trim(),
          staffName: staffUser.name,
        },
      });
    }

    // Populate and return
    await complaint.populate([
      { path: "user", select: "name email" },
      { path: "category", select: "name color" },
      { path: "resolution.resolvedBy", select: "name" },
    ]);

    try {
      if (complaint.user?.email) {
        await sendComplaintStatusEmail(
          complaint.user,
          complaint,
          status === "resolved" ? "Resolved" : "In Progress",
          remarks?.trim(),
        );
      }
    } catch (emailError) {
      console.warn("Status update email failed:", emailError.message);
    }

    res.status(200).json({
      success: true,
      message:
        status === "resolved"
          ? "Complaint resolved successfully. User has been notified."
          : "Status updated successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Update complaint status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating complaint status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Request payment after complaint is resolved
 * @route   POST /api/staff/complaints/:id/request-payment
 * @access  Private/Staff
 */
const requestComplaintPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method = "online", notes } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only assigned staff can request payment",
      });
    }

    if (complaint.status !== "resolved") {
      return res.status(400).json({
        success: false,
        message: "Payment can be requested only after complaint is resolved",
      });
    }

    if (complaint.paymentWorkflow?.paymentStatus === "requested") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been requested for this complaint",
      });
    }

    const payment = await Payment.create({
      organization: complaint.organization,
      complaint: complaint._id,
      paidBy: complaint.user,
      amount: Number(amount),
      method: method === "offline" ? "manual" : "demo",
      purpose: "service_fee",
      gateway: method === "offline" ? "manual" : "razorpay",
      gatewayOrderId: `PAY-REQ-${Date.now()}`,
      notes: notes?.trim() || "Payment requested by staff after resolution",
      metadata: {
        requestedBy: req.user.id,
        requestType: "post_resolution",
      },
    });

    complaint.paymentWorkflow = {
      isPaymentRequested: true,
      paymentStatus: "requested",
      requestedAmount: Number(amount),
      requestedMethod:
        method === "offline"
          ? "offline"
          : method === "online"
            ? "online"
            : "either",
      requestedAt: new Date(),
      requestedBy: req.user.id,
      acknowledgedAt: null,
      acknowledgedBy: null,
      paymentRecord: payment._id,
    };

    complaint.internalNotes.push({
      note: `[PAYMENT] Staff requested payment of INR ${Number(amount)} via ${method} (ref: ${payment.paymentRef})`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    await complaint.save();

    try {
      const complaintUser = await User.findById(complaint.user).select(
        "name email",
      );
      if (complaintUser?.email) {
        await sendEmail({
          to: complaintUser.email,
          subject: `Payment Requested for Complaint ${complaint.complaintId}`,
          html: `<p>Hello ${complaintUser.name || "User"},</p><p>Payment of INR ${Number(amount)} has been requested for complaint <strong>${complaint.complaintId}</strong>.</p><p>Please complete the payment from your dashboard to allow final complaint closure.</p>`,
          text: `Hello ${complaintUser.name || "User"},\n\nPayment of INR ${Number(amount)} has been requested for complaint ${complaint.complaintId}.\nPlease complete payment from your dashboard to allow final closure.`,
        });
      }
    } catch (emailError) {
      console.warn("Payment request email failed:", emailError.message);
    }

    await Notification.create({
      recipient: complaint.user,
      type: "payment_initiated",
      title: "Payment requested for your complaint",
      message: `Staff has completed work on complaint ${complaint.complaintId}. Please complete payment to continue closure.`,
      priority: "high",
      relatedComplaint: complaint._id,
      actionUrl: "/payments/my-payments",
      metadata: {
        paymentId: payment._id,
        amount: Number(amount),
        method,
      },
    });

    const admins = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin"] },
      isActive: true,
      organization: complaint.organization,
    }).select("_id");

    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((admin) => ({
          recipient: admin._id,
          type: "payment_initiated",
          title: "Staff requested complaint payment",
          message: `Complaint ${complaint.complaintId} has a new payment request of INR ${Number(amount)}.`,
          priority: "normal",
          relatedComplaint: complaint._id,
          actionUrl: `/admin/complaints/${complaint._id}`,
        })),
      );
    }

    return res.status(201).json({
      success: true,
      message: "Payment request sent to user successfully",
      data: {
        complaintId: complaint._id,
        paymentId: payment._id,
        paymentRef: payment.paymentRef,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("requestComplaintPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request complaint payment",
    });
  }
};

/**
 * @desc    Acknowledge user payment after confirmation
 * @route   POST /api/staff/complaints/:id/acknowledge-payment
 * @access  Private/Staff
 */
const acknowledgeComplaintPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only assigned staff can acknowledge payment",
      });
    }

    if (complaint.paymentWorkflow?.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment must be completed before acknowledgement",
      });
    }

    complaint.paymentWorkflow.paymentStatus = "acknowledged";
    complaint.paymentWorkflow.acknowledgedAt = new Date();
    complaint.paymentWorkflow.acknowledgedBy = req.user.id;

    complaint.internalNotes.push({
      note: `[PAYMENT] Staff acknowledged payment. ${remarks?.trim() || "No remarks provided."}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    await complaint.save();

    const admins = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin"] },
      isActive: true,
      organization: complaint.organization,
    }).select("_id");

    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((admin) => ({
          recipient: admin._id,
          type: "payment_confirmed",
          title: "Payment acknowledged by staff",
          message: `Complaint ${complaint.complaintId} payment was acknowledged and is ready for admin closure.`,
          priority: "high",
          relatedComplaint: complaint._id,
          actionUrl: `/admin/complaints/${complaint._id}`,
        })),
      );

      try {
        const adminUsers = await User.find({
          _id: { $in: admins.map((admin) => admin._id) },
        }).select("name email");

        await Promise.all(
          adminUsers
            .filter((admin) => !!admin.email)
            .map((admin) =>
              sendEmail({
                to: admin.email,
                subject: `Payment Acknowledged: ${complaint.complaintId}`,
                html: `<p>Hello ${admin.name || "Admin"},</p><p>Staff acknowledged payment for complaint <strong>${complaint.complaintId}</strong>. The complaint is now ready for closure.</p>`,
                text: `Hello ${admin.name || "Admin"},\n\nStaff acknowledged payment for complaint ${complaint.complaintId}. The complaint is now ready for closure.`,
              }),
            ),
        );
      } catch (emailError) {
        console.warn(
          "Admin payment acknowledgement emails failed:",
          emailError.message,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment acknowledged. Admin can now close this complaint.",
      data: complaint.paymentWorkflow,
    });
  } catch (error) {
    console.error("acknowledgeComplaintPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to acknowledge complaint payment",
    });
  }
};

/**
 * @desc    Start staff work session timer for a complaint
 * @route   POST /api/staff/complaints/:id/work-session/start
 * @access  Private/Staff
 */
const startWorkSession = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    if (["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot start timer for resolved/closed complaint",
      });
    }

    if (complaint?.workTracking?.activeSessionStartedAt) {
      return res.status(200).json({
        success: true,
        message: "Work session already active",
        data: {
          workTracking: {
            ...complaint.workTracking.toObject(),
            currentWorkedSeconds: getCurrentWorkedSeconds(complaint),
            isActive: true,
          },
        },
      });
    }

    const now = new Date();
    complaint.workTracking.activeSessionStartedAt = now;
    complaint.workTracking.updatedBy = req.user.id;
    complaint.workTracking.logs.push({
      action: "start",
      at: now,
      by: req.user.id,
      totalSecondsAfterAction: complaint.workTracking.totalSeconds || 0,
    });

    if (complaint.status === "assigned") {
      complaint.status = "in-progress";
      complaint.timeline.firstResponseAt =
        complaint.timeline.firstResponseAt || now;
      complaint.statusHistory.push({
        status: "in-progress",
        changedBy: req.user.id,
        changedByRole: "staff",
        remarks: "Started work timer and began progress",
        changedAt: now,
      });
    }

    complaint.timeline.lastUpdatedAt = now;
    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Work timer started",
      data: {
        workTracking: {
          ...complaint.workTracking.toObject(),
          currentWorkedSeconds: getCurrentWorkedSeconds(complaint),
          isActive: true,
        },
      },
    });
  } catch (error) {
    console.error("startWorkSession error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error starting work timer" });
  }
};

/**
 * @desc    Pause staff work session timer for a complaint
 * @route   POST /api/staff/complaints/:id/work-session/pause
 * @access  Private/Staff
 */
const pauseWorkSession = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    const activeStartedAt = complaint?.workTracking?.activeSessionStartedAt;
    if (!activeStartedAt) {
      return res.status(200).json({
        success: true,
        message: "Work timer already paused",
        data: {
          workTracking: {
            ...complaint.workTracking.toObject(),
            currentWorkedSeconds: getCurrentWorkedSeconds(complaint),
            isActive: false,
          },
        },
      });
    }

    const now = new Date();
    const elapsed = Math.floor(
      (now.getTime() - new Date(activeStartedAt).getTime()) / 1000,
    );
    complaint.workTracking.totalSeconds =
      (complaint.workTracking.totalSeconds || 0) + Math.max(0, elapsed);
    complaint.workTracking.activeSessionStartedAt = null;
    complaint.workTracking.lastPausedAt = now;
    complaint.workTracking.updatedBy = req.user.id;
    complaint.workTracking.logs.push({
      action: "pause",
      at: now,
      by: req.user.id,
      totalSecondsAfterAction: complaint.workTracking.totalSeconds,
    });
    complaint.timeline.lastUpdatedAt = now;
    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Work timer paused",
      data: {
        workTracking: {
          ...complaint.workTracking.toObject(),
          currentWorkedSeconds: complaint.workTracking.totalSeconds,
          isActive: false,
        },
      },
    });
  } catch (error) {
    console.error("pauseWorkSession error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error pausing work timer" });
  }
};

/**
 * @desc    Start working on a complaint (quick action)
 * @route   PUT /api/staff/complaints/:id/start
 * @access  Private/Staff
 */
const startWorkingOnComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Check if already in progress
    if (complaint.status === "in-progress") {
      return res.status(400).json({
        success: false,
        message: "You are already working on this complaint",
      });
    }

    // Check if can start
    const startableStatuses = ["assigned", "reopened", "escalated"];
    if (!startableStatuses.includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start working on a complaint with status "${complaint.status}"`,
      });
    }

    const now = new Date();

    // Update complaint
    complaint.status = "in-progress";
    complaint.timeline.firstResponseAt =
      complaint.timeline.firstResponseAt || now;
    complaint.timeline.lastUpdatedAt = now;

    complaint.statusHistory.push({
      status: "in-progress",
      changedBy: req.user.id,
      changedByRole: "staff",
      remarks: "Started working on the complaint",
      changedAt: now,
    });

    await complaint.save();

    // Notify user
    const staffUser = await User.findById(req.user.id).select("name");

    await Notification.createFromTemplate({
      type: "status_change",
      recipient: complaint.user,
      sender: req.user.id,
      complaint: complaint._id,
      customData: {
        complaintTitle: complaint.title,
        complaintId: complaint.complaintId,
        previousStatus: "assigned",
        newStatus: "in-progress",
        staffName: staffUser.name,
        message: `${staffUser.name} has started working on your complaint.`,
      },
    });

    await complaint.populate([{ path: "category", select: "name color" }]);

    res.status(200).json({
      success: true,
      message: "Started working on the complaint",
      data: complaint,
    });
  } catch (error) {
    console.error("Start working error:", error);
    res.status(500).json({
      success: false,
      message: "Error starting work on complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Add internal note to complaint
 * @route   POST /api/staff/complaints/:id/notes
 * @access  Private/Staff
 */
const addInternalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || note.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Note must be at least 5 characters long",
      });
    }

    if (note.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 1000 characters",
      });
    }

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Add note
    const newNote = {
      note: note.trim(),
      addedBy: req.user.id,
      addedAt: new Date(),
    };

    complaint.internalNotes.push(newNote);
    complaint.timeline.lastUpdatedAt = new Date();

    await complaint.save();

    // Populate notes authors
    await complaint.populate("internalNotes.addedBy", "name role avatar");

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: {
        internalNotes: complaint.internalNotes,
        newNote: complaint.internalNotes[complaint.internalNotes.length - 1],
      },
    });
  } catch (error) {
    console.error("Add internal note error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Delete internal note
 * @route   DELETE /api/staff/complaints/:id/notes/:noteId
 * @access  Private/Staff
 */
const deleteInternalNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Find the note
    const note = complaint.internalNotes.id(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Only allow deleting own notes
    if (note.addedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own notes",
      });
    }

    // Only allow deleting notes within 1 hour
    const noteAge = Date.now() - new Date(note.addedAt).getTime();
    const oneHour = 60 * 60 * 1000;

    if (noteAge > oneHour) {
      return res.status(400).json({
        success: false,
        message: "Notes can only be deleted within 1 hour of creation",
      });
    }

    complaint.internalNotes.pull(noteId);
    await complaint.save();

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete internal note error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting note",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Add resolution evidence/attachments
 * @route   POST /api/staff/complaints/:id/evidence
 * @access  Private/Staff
 */
const addResolutionEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one file",
      });
    }

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      // Clean up uploaded files
      if (req.files) {
        const publicIds = req.files
          .map((f) => f.filename || f.key)
          .filter(Boolean);
        if (publicIds.length > 0) {
          await deleteMultipleFromCloudinary(publicIds).catch(console.error);
        }
      }

      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      // Clean up uploaded files
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }

      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Initialize resolution object if needed
    if (!complaint.resolution) {
      complaint.resolution = { evidence: [] };
    }
    if (!complaint.resolution.evidence) {
      complaint.resolution.evidence = [];
    }

    // Check evidence limit
    const maxEvidence = 10;
    if (complaint.resolution.evidence.length + req.files.length > maxEvidence) {
      // Clean up uploaded files
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: `Maximum ${maxEvidence} evidence files allowed. Currently have ${complaint.resolution.evidence.length}.`,
      });
    }

    // Add evidence files
    const newEvidence = [];
    for (const file of req.files) {
      const evidence = {
        filename: file.filename || file.key || file.originalname,
        originalName: file.originalname,
        url: file.path || file.location || file.secure_url,
        publicId: file.filename || file.key || file.public_id,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      };
      complaint.resolution.evidence.push(evidence);
      newEvidence.push(evidence);
    }

    complaint.timeline.lastUpdatedAt = new Date();

    // Add note about evidence
    complaint.internalNotes.push({
      note: `Added ${req.files.length} resolution evidence file(s)`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    await complaint.save();

    res.status(200).json({
      success: true,
      message: `${req.files.length} evidence file(s) added successfully`,
      data: {
        evidence: complaint.resolution.evidence,
        newEvidence,
      },
    });
  } catch (error) {
    console.error("Add resolution evidence error:", error);

    // Clean up on error
    if (req.files) {
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error adding evidence",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Delete resolution evidence
 * @route   DELETE /api/staff/complaints/:id/evidence/:evidenceId
 * @access  Private/Staff
 */
const deleteResolutionEvidence = async (req, res) => {
  try {
    const { id, evidenceId } = req.params;

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Cannot delete evidence after resolution
    if (complaint.status === "resolved" || complaint.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete evidence after complaint is resolved",
      });
    }

    // Find evidence
    if (!complaint.resolution?.evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    const evidence = complaint.resolution.evidence.id(evidenceId);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    const evidenceName = evidence.originalName;

    // Delete from Cloudinary
    if (evidence.publicId) {
      try {
        await deleteFromCloudinary(evidence.publicId);
      } catch (err) {
        console.error("Error deleting from Cloudinary:", err);
      }
    }

    // Remove from complaint
    complaint.resolution.evidence.pull(evidenceId);
    complaint.timeline.lastUpdatedAt = new Date();

    await complaint.save();

    res.status(200).json({
      success: true,
      message: `Evidence "${evidenceName}" deleted successfully`,
      data: {
        evidence: complaint.resolution.evidence,
      },
    });
  } catch (error) {
    console.error("Delete resolution evidence error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting evidence",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Resolve complaint with full details
 * @route   POST /api/staff/complaints/:id/resolve
 * @access  Private/Staff
 */
const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks || remarks.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message:
          "Resolution remarks must be at least 20 characters long. Please explain how the issue was resolved.",
      });
    }

    if (remarks.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Resolution remarks cannot exceed 2000 characters",
      });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Verify complaint can be resolved
    const resolvableStatuses = [
      "assigned",
      "in-progress",
      "reopened",
      "escalated",
    ];
    if (!resolvableStatuses.includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot resolve complaint with status "${complaint.status}"`,
      });
    }

    const now = new Date();

    // Process evidence files if uploaded
    const newEvidence = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        newEvidence.push({
          filename: file.filename || file.key || file.originalname,
          originalName: file.originalname,
          url: file.path || file.location || file.secure_url,
          publicId: file.filename || file.key || file.public_id,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: now,
        });
      }
    }

    // Update complaint
    complaint.status = "resolved";
    complaint.timeline.resolvedAt = now;
    complaint.timeline.lastUpdatedAt = now;

    if (!complaint.timeline.firstResponseAt) {
      complaint.timeline.firstResponseAt = now;
    }

    // Combine existing evidence with new evidence
    const existingEvidence = complaint.resolution?.evidence || [];

    complaint.resolution = {
      remarks: remarks.trim(),
      resolvedBy: req.user.id,
      evidence: [...existingEvidence, ...newEvidence],
      satisfaction: "pending",
    };

    // Check SLA compliance
    if (
      complaint.resolutionDeadline &&
      now <= new Date(complaint.resolutionDeadline)
    ) {
      complaint.slaBreached = false;
    }

    // Add to status history
    complaint.statusHistory.push({
      status: "resolved",
      changedBy: req.user.id,
      changedByRole: "staff",
      remarks: `Resolved: ${remarks.trim().substring(0, 200)}${remarks.trim().length > 200 ? "..." : ""}`,
      changedAt: now,
    });

    await complaint.save();

    // Get staff info for notification
    const staffUser = await User.findById(req.user.id).select("name");

    // Notify user about resolution
    await Notification.createFromTemplate({
      type: "complaint_resolved",
      recipient: complaint.user,
      sender: req.user.id,
      complaint: complaint._id,
      customData: {
        complaintTitle: complaint.title,
        complaintId: complaint.complaintId,
        remarks: remarks.trim(),
        staffName: staffUser.name,
      },
    });

    // Populate and return
    await complaint.populate([
      { path: "user", select: "name email" },
      { path: "category", select: "name color icon" },
      { path: "resolution.resolvedBy", select: "name email" },
    ]);

    // Calculate resolution metrics
    const assignedAt =
      complaint.timeline.assignedAt || complaint.timeline.submittedAt;
    const resolutionTimeHours =
      Math.round(((now - new Date(assignedAt)) / 3600000) * 10) / 10;

    res.status(200).json({
      success: true,
      message:
        "Complaint resolved successfully. The user has been notified and can now provide feedback.",
      data: {
        complaint,
        metrics: {
          resolutionTimeHours,
          withinSLA: !complaint.slaBreached,
          evidenceCount: complaint.resolution.evidence.length,
        },
      },
    });
  } catch (error) {
    console.error("Resolve complaint error:", error);

    // Clean up files on error
    if (req.files) {
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error resolving complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Request reassignment
 * @route   POST /api/staff/complaints/:id/request-reassignment
 * @access  Private/Staff
 */
const requestReassignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, suggestedStaffId } = req.body;

    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a detailed reason for reassignment request (at least 20 characters)",
      });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify assignment
    if (complaint.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not assigned to you",
      });
    }

    // Cannot request reassignment for resolved/closed
    if (["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot request reassignment for resolved or closed complaints",
      });
    }

    // Get staff info
    const staffUser = await User.findById(req.user.id).select(
      "name email department",
    );

    // Get suggested staff info if provided
    let suggestedStaff = null;
    if (suggestedStaffId) {
      suggestedStaff = await User.findOne({
        _id: suggestedStaffId,
        role: "staff",
        isActive: true,
      }).select("name email department");
    }

    // Add internal note
    const noteText = suggestedStaff
      ? `[REASSIGNMENT REQUEST] Reason: ${reason.trim()}. Suggested assignee: ${suggestedStaff.name}`
      : `[REASSIGNMENT REQUEST] Reason: ${reason.trim()}`;

    complaint.internalNotes.push({
      note: noteText,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    complaint.timeline.lastUpdatedAt = new Date();
    await complaint.save();

    // Notify all admins
    const admins = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin"] },
      isActive: true,
    }).select("_id");

    const notificationPromises = admins.map((admin) =>
      Notification.create({
        recipient: admin._id,
        type: "reassignment",
        title: "Reassignment Request",
        message: `${staffUser.name} has requested reassignment of complaint "${complaint.complaintId}".`,
        priority: "high",
        relatedComplaint: complaint._id,
        actionUrl: `/admin/complaints/${complaint._id}`,
        metadata: {
          requestedBy: req.user.id,
          requestedByName: staffUser.name,
          requestedByDepartment: staffUser.department,
          reason: reason.trim(),
          suggestedStaffId: suggestedStaff?._id,
          suggestedStaffName: suggestedStaff?.name,
          currentStatus: complaint.status,
          priority: complaint.priority,
        },
      }),
    );

    await Promise.all(notificationPromises);

    res.status(200).json({
      success: true,
      message:
        "Reassignment request submitted successfully. Administrators have been notified.",
      data: {
        complaintId: complaint.complaintId,
        requestedAt: new Date(),
        suggestedStaff: suggestedStaff
          ? {
              id: suggestedStaff._id,
              name: suggestedStaff.name,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Request reassignment error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting reassignment request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get staff performance/statistics
 * @route   GET /api/staff/performance
 * @access  Private/Staff
 */
const getMyPerformance = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const staffId = new mongoose.Types.ObjectId(req.user.id);

    // Parse period
    let daysBack = 30;
    if (period.endsWith("d")) {
      daysBack = parseInt(period);
    } else if (period.endsWith("w")) {
      daysBack = parseInt(period) * 7;
    } else if (period.endsWith("m")) {
      daysBack = parseInt(period) * 30;
    }

    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const [
      complaintStats,
      resolutionMetrics,
      feedbackStats,
      dailyTrend,
      categoryPerformance,
      priorityBreakdown,
    ] = await Promise.all([
      // Overall complaint stats for period
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            "timeline.assignedAt": { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["assigned", "in-progress", "reopened"]] },
                  1,
                  0,
                ],
              },
            },
            escalated: {
              $sum: { $cond: [{ $eq: ["$status", "escalated"] }, 1, 0] },
            },
            slaBreached: {
              $sum: { $cond: ["$slaBreached", 1, 0] },
            },
            reopened: {
              $sum: { $cond: [{ $gt: ["$reopenCount", 0] }, 1, 0] },
            },
          },
        },
      ]),

      // Resolution time metrics
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            "timeline.resolvedAt": { $exists: true, $gte: startDate },
          },
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ["$timeline.resolvedAt", "$timeline.assignedAt"] },
                3600000,
              ],
            },
            firstResponseTime: {
              $cond: [
                { $and: ["$timeline.firstResponseAt", "$timeline.assignedAt"] },
                {
                  $divide: [
                    {
                      $subtract: [
                        "$timeline.firstResponseAt",
                        "$timeline.assignedAt",
                      ],
                    },
                    3600000,
                  ],
                },
                null,
              ],
            },
            priority: 1,
            slaBreached: 1,
          },
        },
        {
          $group: {
            _id: null,
            avgResolutionTime: { $avg: "$resolutionTime" },
            minResolutionTime: { $min: "$resolutionTime" },
            maxResolutionTime: { $max: "$resolutionTime" },
            avgFirstResponseTime: { $avg: "$firstResponseTime" },
            count: { $sum: 1 },
            slaCompliant: {
              $sum: { $cond: ["$slaBreached", 0, 1] },
            },
          },
        },
      ]),

      // Feedback statistics
      Feedback.getStaffStats(req.user.id),

      // Daily trend
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            received: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Performance by category
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            "timeline.assignedAt": { $gte: startDate },
          },
        },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        { $unwind: "$categoryInfo" },
        {
          $project: {
            name: "$categoryInfo.name",
            color: "$categoryInfo.color",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Priority breakdown
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            "timeline.assignedAt": { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$priority",
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
              },
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  "$timeline.resolvedAt",
                  {
                    $divide: [
                      {
                        $subtract: [
                          "$timeline.resolvedAt",
                          "$timeline.assignedAt",
                        ],
                      },
                      3600000,
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = complaintStats[0] || {
      total: 0,
      resolved: 0,
      pending: 0,
      escalated: 0,
      slaBreached: 0,
      reopened: 0,
    };

    const resolution = resolutionMetrics[0] || {
      avgResolutionTime: 0,
      minResolutionTime: 0,
      maxResolutionTime: 0,
      avgFirstResponseTime: 0,
      count: 0,
      slaCompliant: 0,
    };

    // Calculate rates
    const resolutionRate =
      stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

    const slaComplianceRate =
      resolution.count > 0
        ? Math.round((resolution.slaCompliant / resolution.count) * 100)
        : 100;

    const reopenRate =
      stats.resolved > 0
        ? Math.round((stats.reopened / stats.resolved) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        period: { days: daysBack, startDate },
        summary: {
          total: stats.total,
          resolved: stats.resolved,
          pending: stats.pending,
          escalated: stats.escalated,
          resolutionRate,
          slaComplianceRate,
          reopenRate,
        },
        resolutionMetrics: {
          avgResolutionTimeHours:
            Math.round(resolution.avgResolutionTime * 10) / 10,
          minResolutionTimeHours:
            Math.round(resolution.minResolutionTime * 10) / 10,
          maxResolutionTimeHours:
            Math.round(resolution.maxResolutionTime * 10) / 10,
          avgFirstResponseTimeHours:
            Math.round((resolution.avgFirstResponseTime || 0) * 10) / 10,
          slaCompliantCount: resolution.slaCompliant,
          totalResolved: resolution.count,
        },
        feedback: {
          averageRating:
            Math.round((feedbackStats.averageRating || 0) * 10) / 10,
          totalFeedbacks: feedbackStats.totalFeedbacks || 0,
          ratingDistribution: feedbackStats.ratingDistribution || {},
          recommendationRate: feedbackStats.recommendationRate || 0,
        },
        trends: {
          daily: dailyTrend,
          byCategory: categoryPerformance,
          byPriority: priorityBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              total: item.total,
              resolved: item.resolved,
              resolutionRate:
                item.total > 0
                  ? Math.round((item.resolved / item.total) * 100)
                  : 0,
              avgResolutionTimeHours:
                Math.round((item.avgResolutionTime || 0) * 10) / 10,
            };
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error("Get performance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching performance data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get my feedback history
 * @route   GET /api/staff/feedback
 * @access  Private/Staff
 */
const getMyFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10, rating } = req.query;

    const query = { resolvedBy: req.user.id };

    if (rating) {
      query.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total, stats] = await Promise.all([
      Feedback.find(query)
        .populate("complaint", "complaintId title category")
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Feedback.countDocuments(query),
      Feedback.getStaffStats(req.user.id),
    ]);

    // Mask user info for anonymous feedback
    const maskedFeedbacks = feedbacks.map((fb) => {
      if (fb.isAnonymous) {
        return { ...fb, user: null };
      }
      return fb;
    });

    res.status(200).json({
      success: true,
      data: {
        feedbacks: maskedFeedbacks,
        statistics: stats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get my feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get available staff for suggestion (when requesting reassignment)
 * @route   GET /api/staff/available-staff
 * @access  Private/Staff
 */
const getAvailableStaffForSuggestion = async (req, res) => {
  try {
    const { category } = req.query;

    const availableStaff = await User.findAvailableStaff(category || null);

    // Filter out self
    const filteredStaff = availableStaff.filter(
      (staff) => staff._id.toString() !== req.user.id,
    );

    res.status(200).json({
      success: true,
      data: filteredStaff.map((staff) => ({
        id: staff._id,
        name: staff.name,
        department: staff.department,
        availableCapacity: staff.availableCapacity,
        specializations: staff.specializations,
      })),
    });
  } catch (error) {
    console.error("Get available staff error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available staff",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get workload summary
 * @route   GET /api/staff/workload
 * @access  Private/Staff
 */
const getWorkload = async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.user.id);

    const [workloadData, staffInfo] = await Promise.all([
      Complaint.aggregate([
        {
          $match: {
            assignedTo: staffId,
            status: {
              $in: ["assigned", "in-progress", "reopened", "escalated"],
            },
          },
        },
        {
          $facet: {
            byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
            byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            total: [{ $count: "count" }],
            overdue: [
              {
                $match: { resolutionDeadline: { $lt: new Date() } },
              },
              { $count: "count" },
            ],
            dueSoon: [
              {
                $match: {
                  resolutionDeadline: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 4 * 60 * 60 * 1000), // Next 4 hours
                  },
                },
              },
              { $count: "count" },
            ],
            deadlines: [
              { $sort: { resolutionDeadline: 1 } },
              { $limit: 5 },
              {
                $project: {
                  complaintId: 1,
                  title: 1,
                  priority: 1,
                  resolutionDeadline: 1,
                  status: 1,
                },
              },
            ],
          },
        },
      ]),
      User.findById(req.user.id).select("maxAssignedComplaints"),
    ]);

    const data = workloadData[0];
    const activeCount = data.total[0]?.count || 0;
    const maxCapacity = staffInfo?.maxAssignedComplaints || 10;

    res.status(200).json({
      success: true,
      data: {
        active: activeCount,
        capacity: {
          current: activeCount,
          max: maxCapacity,
          available: Math.max(0, maxCapacity - activeCount),
          percentage: Math.round((activeCount / maxCapacity) * 100),
        },
        byPriority: data.byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byStatus: data.byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        overdue: data.overdue[0]?.count || 0,
        dueSoon: data.dueSoon[0]?.count || 0,
        upcomingDeadlines: data.deadlines.map((c) => ({
          ...c,
          isOverdue:
            c.resolutionDeadline && new Date() > new Date(c.resolutionDeadline),
          hoursRemaining: c.resolutionDeadline
            ? Math.floor(
                (new Date(c.resolutionDeadline) - new Date()) / 3600000,
              )
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Get workload error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching workload",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Export all functions
module.exports = {
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
};
