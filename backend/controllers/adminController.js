/**
 * Admin Controller
 *
 * Handles admin-specific operations including:
 * - Dashboard analytics and statistics
 * - Complaint management (view all, assign, reassign)
 * - Staff management
 * - Escalation management
 * - System-wide operations
 */

const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Category = require("../models/Category");
const Organization = require("../models/Organization");
const Feedback = require("../models/Feedback");
const StaffFeedback = require("../models/StaffFeedback");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

/**
 * @desc    Get all system users
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    // If not super admin, restrict to own organization
    if (req.user.role !== "super_admin") {
      query.organization = req.user.organization;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .populate("organization", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parsedPage,
          totalPages: Math.ceil(total / parsedLimit),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};

    // Org Filter: Super Admin sees all, Org Admin sees their own
    let orgFilter = {};
    let feedbackOrgFilter = {};

    if (req.user.role !== "super_admin") {
      if (req.user.organization) {
        const orgId = new mongoose.Types.ObjectId(req.user.organization);
        orgFilter = { organization: orgId };
        feedbackOrgFilter = {
          "complaintInfo.organization": orgId,
        };
      }
    }

    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const dateMatch =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Combine filters
    const matchQuery = { ...dateMatch, ...orgFilter };
    const staffMatch = {
      role: "staff",
      isActive: true,
      ...(req.user.role !== "super_admin" && req.user.organization
        ? { organization: new mongoose.Types.ObjectId(req.user.organization) }
        : {}),
    };

    // Parallel execution for performance
    const [
      totalComplaints,
      complaintsByStatus,
      complaintsByPriority,
      complaintsByCategory,
      recentComplaints,
      overdueComplaints,
      escalatedComplaints,
      staffStats,
      userStats,
      feedbackStats,
      trendsData,
      avgResolutionTime,
    ] = await Promise.all([
      // Total complaints count
      Complaint.countDocuments(matchQuery),

      // Complaints grouped by status
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Complaints grouped by priority
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),

      // Complaints grouped by category
      Complaint.aggregate([
        { $match: matchQuery },
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
        { $limit: 10 },
      ]),

      // Recent complaints
      Complaint.find(matchQuery)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("category", "name color")
        .select("complaintId title status priority createdAt")
        .lean(),

      // Overdue complaints count
      Complaint.countDocuments({
        ...matchQuery,
        status: { $nin: ["resolved", "closed"] },
        resolutionDeadline: { $lt: new Date() },
      }),

      // Escalated complaints count
      Complaint.countDocuments({
        ...matchQuery,
        status: "escalated",
      }),

      // Staff statistics
      User.aggregate([
        {
          $match: staffMatch,
        },
        {
          $lookup: {
            from: "complaints",
            let: { staffId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$assignedTo", "$$staffId"] },
                },
              },
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
            as: "complaintStats",
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            department: 1,
            complaintStats: 1,
          },
        },
      ]),

      // User statistics
      User.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
            active: {
              $sum: { $cond: ["$isActive", 1, 0] },
            },
          },
        },
      ]),

      // Feedback statistics
      // Feedback.getOverallStats(dateFilter), // Need to update this helper or filter manually
      Feedback.aggregate([
        // Assuming Feedback has 'complaint' ref which has 'organization', or we added organization to Feedback
        // For now, let's filter by complaint.
        {
          $lookup: {
            from: "complaints",
            localField: "complaint",
            foreignField: "_id",
            as: "complaintInfo",
          },
        },
        { $unwind: "$complaintInfo" },
        { $match: { ...feedbackOrgFilter, ...dateMatch } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            count: { $sum: 1 },
            ratingDistribution: {
              $push: "$rating",
            },
          },
        },
      ]),

      // Trends - complaints over time (last 30 days)
      Complaint.aggregate([
        {
          $match: {
            ...orgFilter, // Filter by Org
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Average resolution time
      Complaint.aggregate([
        {
          $match: {
            ...dateMatch,
            ...orgFilter,
            "timeline.resolvedAt": { $exists: true },
          },
        },
        {
          $project: {
            resolutionTime: {
              $subtract: ["$timeline.resolvedAt", "$timeline.submittedAt"],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: "$resolutionTime" },
          },
        },
      ]),
    ]);

    // Calculate averages and rates
    const resolvedCount =
      complaintsByStatus.find((s) => s._id === "resolved")?.count || 0;
    const closedCount =
      complaintsByStatus.find((s) => s._id === "closed")?.count || 0;
    const resolutionRate =
      totalComplaints > 0
        ? (((resolvedCount + closedCount) / totalComplaints) * 100).toFixed(1)
        : 0;

    const avgResolutionHours = avgResolutionTime[0]
      ? Math.round(avgResolutionTime[0].avgTime / (1000 * 60 * 60))
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalComplaints,
          overdueComplaints,
          escalatedComplaints,
          resolutionRate: parseFloat(resolutionRate),
          avgResolutionHours,
          pendingComplaints: totalComplaints - resolvedCount - closedCount,
        },
        complaintsByStatus: complaintsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        complaintsByPriority: complaintsByPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        complaintsByCategory,
        recentComplaints,
        staffStats,
        userStats: userStats.reduce((acc, item) => {
          acc[item._id] = { total: item.count, active: item.active };
          return acc;
        }, {}),
        feedbackStats,
        trends: trendsData,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get all complaints with filters
 * @route   GET /api/admin/complaints
 * @access  Private/Admin
 */
const getAllComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      assignedTo,
      search,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      isOverdue,
      slaBreached,
    } = req.query;

    // Build query
    const query = {
      isArchived: false,
    };

    if (req.user.role !== "super_admin") {
      query.organization = req.user.organization;
    }

    if (status) {
      if (status.includes(",")) {
        query.status = { $in: status.split(",") };
      } else {
        query.status = status;
      }
    }

    if (priority) {
      if (priority.includes(",")) {
        query.priority = { $in: priority.split(",") };
      } else {
        query.priority = priority;
      }
    }

    if (category) {
      query.category = category;
    }

    if (assignedTo) {
      if (assignedTo === "unassigned") {
        query.assignedTo = null;
      } else {
        query.assignedTo = assignedTo;
      }
    }

    if (search) {
      query.$or = [
        { complaintId: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (isOverdue === "true") {
      query.resolutionDeadline = { $lt: new Date() };
      query.status = { $nin: ["resolved", "closed"] };
    }

    if (slaBreached === "true") {
      query.slaBreached = true;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate("user", "name email phone")
        .populate("assignedTo", "name email department")
        .populate("category", "name color icon")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Complaint.countDocuments(query),
    ]);

    // Add computed fields
    const complaintsWithExtras = complaints.map((complaint) => {
      const workBase = complaint?.workTracking?.totalSeconds || 0;
      const activeStart = complaint?.workTracking?.activeSessionStartedAt;
      const liveSeconds = activeStart
        ? Math.floor((Date.now() - new Date(activeStart).getTime()) / 1000)
        : 0;

      return {
        ...complaint,
        isOverdue:
          complaint.resolutionDeadline &&
          new Date() > new Date(complaint.resolutionDeadline) &&
          !["resolved", "closed"].includes(complaint.status),
        ageInHours: Math.floor(
          (new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60),
        ),
        workTracking: {
          ...(complaint.workTracking || {}),
          currentWorkedSeconds: Math.max(0, workBase + liveSeconds),
          isActive: !!activeStart,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        complaints: complaintsWithExtras,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: skip + complaints.length < total,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching complaints",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get unassigned complaints
 * @route   GET /api/admin/complaints/unassigned
 * @access  Private/Admin
 */
const getUnassignedComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {
      assignedTo: null,
      status: "new",
      isArchived: false,
    };
    if (req.user.role !== "super_admin") {
      query.organization = req.user.organization;
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate("user", "name email")
        .populate("category", "name color")
        .sort({ priority: -1, createdAt: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Complaint.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        complaints,
        pagination: {
          currentPage: parsedPage,
          totalPages: Math.ceil(total / parsedLimit),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get unassigned complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unassigned complaints",
    });
  }
};

/**
 * @desc    Assign complaint to staff
 * @route   POST /api/admin/complaints/:id/assign
 * @access  Private/Admin
 */
const assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, remarks, priority } = req.body;

    // Validate complaint exists
    const complaintQuery = { _id: id };
    if (req.user.role !== "super_admin") {
      complaintQuery.organization = req.user.organization;
    }
    const complaint = await Complaint.findOne(complaintQuery);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Validate staff exists and is active
    const staffQuery = {
      _id: staffId,
      role: "staff",
      isActive: true,
    };
    if (req.user.role !== "super_admin") {
      staffQuery.organization = req.user.organization;
    } else if (complaint.organization) {
      staffQuery.organization = complaint.organization;
    }
    const staff = await User.findOne(staffQuery);

    if (!staff) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive staff member",
      });
    }

    // Check staff workload
    const activeAssignments = await Complaint.countDocuments({
      assignedTo: staffId,
      status: { $in: ["assigned", "in-progress"] },
    });

    if (activeAssignments >= staff.maxAssignedComplaints) {
      return res.status(400).json({
        success: false,
        message: `Staff member has reached maximum assignments (${staff.maxAssignedComplaints})`,
      });
    }

    // Update priority if provided
    if (priority && ["low", "medium", "high", "critical"].includes(priority)) {
      complaint.priority = priority;
    }

    // Assign complaint
    complaint.assignedTo = staffId;
    complaint.assignedBy = req.user.id;
    complaint.status = "assigned";
    complaint.timeline.assignedAt = new Date();

    // Calculate deadline based on category SLA
    await complaint.populate("category");
    if (complaint.category && complaint.category.resolutionSLA) {
      const slaHours =
        complaint.category.resolutionSLA[complaint.priority] || 48;
      complaint.resolutionDeadline = new Date(
        Date.now() + slaHours * 60 * 60 * 1000,
      );
    }

    // Add to status history
    complaint.statusHistory.push({
      status: "assigned",
      changedBy: req.user.id,
      changedByRole: "admin",
      remarks: remarks || `Assigned to ${staff.name}`,
      changedAt: new Date(),
    });

    await complaint.save();

    // Create notifications
    await Promise.all([
       // Notify staff
       notificationService.sendInAppFromTemplate({
         type: "new_assignment",
         recipient: staffId,
         sender: req.user.id,
         complaint: complaint._id,
         customData: {
           complaintTitle: complaint.title,
           complaintId: complaint.complaintId,
           priority: complaint.priority,
           deadline: complaint.resolutionDeadline,
         },
       }),

       // Notify user
       notificationService.sendInAppFromTemplate({
         type: "complaint_assigned",
         recipient: complaint.user,
         sender: req.user.id,
         complaint: complaint._id,
         customData: {
           complaintTitle: complaint.title,
           complaintId: complaint.complaintId,
           staffName: staff.name,
         },
       }),
     ]);

    // Populate and return updated complaint
    await complaint.populate([
      { path: "user", select: "name email" },
      { path: "assignedTo", select: "name email department" },
      { path: "category", select: "name color" },
    ]);

    res.status(200).json({
      success: true,
      message: "Complaint assigned successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Assign complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Reassign complaint to different staff
 * @route   PUT /api/admin/complaints/:id/reassign
 * @access  Private/Admin
 */
const reassignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reassignment reason is required",
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

    const previousAssignee = complaint.assignedTo;

    // Validate new staff
    const newStaff = await User.findOne({
      _id: staffId,
      role: "staff",
      isActive: true,
      organization: req.user.organization,
    });

    if (!newStaff) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive staff member",
      });
    }

    // Update complaint
    complaint.assignedTo = staffId;
    complaint.assignedBy = req.user.id;

    // Add to status history
    complaint.statusHistory.push({
      status: complaint.status,
      changedBy: req.user.id,
      changedByRole: "admin",
      remarks: `Reassigned to ${newStaff.name}. Reason: ${reason}`,
      changedAt: new Date(),
    });

    // Add internal note
    complaint.internalNotes.push({
      note: `Reassigned from previous assignee to ${newStaff.name}. Reason: ${reason}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    await complaint.save();

    // Notifications
    const notifications = [
      // Notify new staff
      notificationService.sendInAppFromTemplate({
        type: "new_assignment",
        recipient: staffId,
        sender: req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
          isReassignment: true,
        },
      }),
    ];

    // Notify previous assignee if exists
    if (previousAssignee) {
      notifications.push(
        notificationService.sendInAppFromTemplate({
          type: "assignment_removed",
          recipient: previousAssignee,
          sender: req.user.id,
          complaint: complaint._id,
          customData: {
            complaintTitle: complaint.title,
            complaintId: complaint.complaintId,
            reason,
          },
        }),
      );
    }

    await Promise.all(notifications);

    await complaint.populate([
      { path: "assignedTo", select: "name email department" },
      { path: "category", select: "name color" },
    ]);

    res.status(200).json({
      success: true,
      message: "Complaint reassigned successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Reassign complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error reassigning complaint",
    });
  }
};

/**
 * @desc    Bulk assign complaints
 * @route   POST /api/admin/complaints/bulk-assign
 * @access  Private/Admin
 */
const bulkAssignComplaints = async (req, res) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Assignments array is required",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const assignment of assignments) {
      try {
        const { complaintId, staffId } = assignment;

        const complaint = await Complaint.findOne({
          _id: complaintId,
          organization: req.user.organization,
        });
        const staff = await User.findOne({
          _id: staffId,
          role: "staff",
          isActive: true,
          organization: req.user.organization,
        });

        if (!complaint || !staff) {
          results.failed.push({
            complaintId,
            reason: !complaint ? "Complaint not found" : "Staff not found",
          });
          continue;
        }

        complaint.assignedTo = staffId;
        complaint.assignedBy = req.user.id;
        complaint.status = "assigned";
        complaint.timeline.assignedAt = new Date();

        complaint.statusHistory.push({
          status: "assigned",
          changedBy: req.user.id,
          changedByRole: "admin",
          remarks: `Bulk assigned to ${staff.name}`,
          changedAt: new Date(),
        });

        await complaint.save();

        // Create notification
        await notificationService.sendInAppFromTemplate({
          type: "new_assignment",
          recipient: staffId,
          sender: req.user.id,
          complaint: complaint._id,
          customData: {
            complaintTitle: complaint.title,
            complaintId: complaint.complaintId,
          },
        });

        results.successful.push({
          complaintId: complaint.complaintId,
          staffName: staff.name,
        });
      } catch (err) {
        results.failed.push({
          complaintId: assignment.complaintId,
          reason: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Assigned ${results.successful.length} complaints, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk assign error:", error);
    res.status(500).json({
      success: false,
      message: "Error in bulk assignment",
    });
  }
};

/**
 * @desc    Get escalated complaints
 * @route   GET /api/admin/complaints/escalated
 * @access  Private/Admin
 */
const getEscalatedComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10, organization } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      status: "escalated",
      isArchived: false,
    };

    if (req.user.role !== "super_admin") {
      query.organization = req.user.organization;
    } else if (organization) {
      if (!mongoose.Types.ObjectId.isValid(organization)) {
        return res.status(400).json({
          success: false,
          message: "Invalid organization ID format",
        });
      }
      query.organization = new mongoose.Types.ObjectId(organization);
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate("user", "name email")
        .populate("assignedTo", "name email department")
        .populate("category", "name color")
        .sort({ "timeline.escalatedAt": -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Complaint.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        complaints,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get escalated complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching escalated complaints",
    });
  }
};

/**
 * @desc    Manually escalate a complaint
 * @route   POST /api/admin/complaints/:id/escalate
 * @access  Private/Admin
 */
const escalateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, reassignTo } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Escalation reason is required",
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Role-based tenant boundary enforcement
    if (req.user.role !== "super_admin") {
      if (
        !req.user.organization ||
        !complaint.organization ||
        complaint.organization.toString() !== req.user.organization.toString()
      ) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
    }

    // Validate reassignment target if provided
    if (reassignTo) {
      const targetStaff = await User.findOne({
        _id: reassignTo,
        role: "staff",
        isActive: true,
      });

      if (!targetStaff) {
        return res.status(400).json({
          success: false,
          message: "Selected staff member not found or inactive",
        });
      }

      // If org_admin, target staff must belong to the same organization
      if (
        req.user.role !== "super_admin" &&
        (!targetStaff.organization ||
          targetStaff.organization.toString() !==
            complaint.organization.toString())
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Reassignment target must belong to the complaint's organization",
        });
      }
    }

    if (complaint.status === "escalated") {
      return res.status(400).json({
        success: false,
        message: "Complaint is already escalated",
      });
    }

    // Add escalation
    complaint.addEscalation({
      reason,
      escalatedBy: req.user.id,
      escalationType: "manual",
      reassignedTo: reassignTo || null,
    });

    // Add status history
    complaint.statusHistory.push({
      status: "escalated",
      changedBy: req.user.id,
      changedByRole: "admin",
      remarks: `Manually escalated. Reason: ${reason}`,
      changedAt: new Date(),
    });

    await complaint.save();

    // Notifications
    const notifications = [];

    // Notify current assignee if exists
    if (complaint.assignedTo) {
      notifications.push(
        notificationService.sendInAppFromTemplate({
          type: "complaint_escalated",
          recipient: complaint.assignedTo,
          sender: req.user.id,
          complaint: complaint._id,
          customData: {
            complaintTitle: complaint.title,
            complaintId: complaint.complaintId,
            reason,
          },
        }),
      );
    }

    // Notify user
    notifications.push(
      notificationService.sendInAppFromTemplate({
        type: "complaint_updated",
        recipient: complaint.user,
        sender: req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
          message: "Your complaint has been escalated for priority handling.",
        },
      }),
    );

    await Promise.all(notifications);

    await complaint.populate([
      { path: "user", select: "name email" },
      { path: "assignedTo", select: "name email" },
      { path: "category", select: "name color" },
    ]);

    res.status(200).json({
      success: true,
      message: "Complaint escalated successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Escalate complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error escalating complaint",
    });
  }
};

/**
 * @desc    Get all staff members with statistics
 * @route   GET /api/admin/staff
 * @access  Private/Admin
 */
const getAllStaff = async (req, res) => {
  try {
    const { department, isActive, search, organization, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let targetOrgId = null;
    if (req.user.role === "super_admin") {
      if (organization) {
        if (!mongoose.Types.ObjectId.isValid(organization)) {
          return res.status(400).json({
            success: false,
            message: "Invalid organization ID format",
          });
        }
        targetOrgId = new mongoose.Types.ObjectId(organization);
      }
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "User does not belong to any organization",
        });
      }
      targetOrgId = new mongoose.Types.ObjectId(req.user.organization);
    }

    const query = {
      role: "staff",
      ...(targetOrgId ? { organization: targetOrgId } : {}),
    };

    if (department) {
      query.department = department;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const staff = await User.aggregate([
      { $match: query },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "complaints",
          let: { staffId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$assignedTo", "$$staffId"] },
              },
            },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          as: "complaintsByStatus",
        },
      },
      {
        $lookup: {
          from: "feedbacks",
          let: { staffId: "$_id" },
          pipeline: [
            {
              $lookup: {
                from: "complaints",
                localField: "complaint",
                foreignField: "_id",
                as: "complaintInfo",
              },
            },
            { $unwind: "$complaintInfo" },
            {
              $match: {
                $expr: { $eq: ["$complaintInfo.assignedTo", "$$staffId"] },
              },
            },
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalFeedbacks: { $sum: 1 },
              },
            },
          ],
          as: "complaintFeedbackStats",
        },
      },
      {
        $lookup: {
          from: "stafffeedbacks",
          let: { staffId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$staffMember", "$$staffId"] },
              },
            },
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalCount: { $sum: 1 },
                adminFeedbackCount: {
                  $sum: { $cond: [{ $eq: ["$feedbackType", "admin"] }, 1, 0] },
                },
                userFeedbackCount: {
                  $sum: { $cond: [{ $eq: ["$feedbackType", "user"] }, 1, 0] },
                },
                ratingDistribution: { $push: "$rating" },
              },
            },
          ],
          as: "staffFeedbackStats",
        },
      },
      {
        $lookup: {
          from: "organizations",
          localField: "organization",
          foreignField: "_id",
          as: "organizationDetails",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "specializations",
          foreignField: "_id",
          as: "specializationDetails",
        },
      },
      {
        $project: {
          password: 0,
          refreshToken: 0,
          resetPasswordToken: 0,
        },
      },
    ]);

    const total = await User.countDocuments(query);

    // Format staff data
    const formattedStaff = staff.map((member) => {
      const complaints = member.complaintsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      // Complaint-based feedback (legacy)
      const complaintFeedback = member.complaintFeedbackStats[0] || {
        avgRating: 0,
        totalFeedbacks: 0,
      };

      // Staff feedback (new system)
      const staffFeedback = member.staffFeedbackStats[0] || {
        avgRating: 0,
        totalCount: 0,
        adminFeedbackCount: 0,
        userFeedbackCount: 0,
        ratingDistribution: [],
      };

      // Calculate combined statistics
      const totalFeedbacks =
        complaintFeedback.totalFeedbacks + staffFeedback.totalCount;
      const averageRating =
        totalFeedbacks > 0
          ? (complaintFeedback.avgRating * complaintFeedback.totalFeedbacks +
              staffFeedback.avgRating * staffFeedback.totalCount) /
            totalFeedbacks
          : 0;

      // Rating distribution for staff feedback
      const ratingDistribution = staffFeedback.ratingDistribution.reduce(
        (acc, rating) => {
          acc[rating] = (acc[rating] || 0) + 1;
          return acc;
        },
        { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      );

      return {
        ...member,
        statistics: {
          complaints: {
            assigned: complaints["assigned"] || 0,
            inProgress: complaints["in-progress"] || 0,
            resolved: complaints["resolved"] || 0,
            total: Object.values(complaints).reduce((a, b) => a + b, 0),
          },
          feedback: {
            averageRating: Math.round(averageRating * 10) / 10 || 0,
            totalCount: totalFeedbacks,
            staffFeedback: {
              averageRating: Math.round(staffFeedback.avgRating * 10) / 10 || 0,
              totalCount: staffFeedback.totalCount,
              adminFeedbackCount: staffFeedback.adminFeedbackCount,
              userFeedbackCount: staffFeedback.userFeedbackCount,
              ratingDistribution,
            },
            complaintFeedback: {
              averageRating:
                Math.round(complaintFeedback.avgRating * 10) / 10 || 0,
              totalFeedbacks: complaintFeedback.totalFeedbacks,
            },
          },
        },
        specializations: member.specializationDetails,
        organization: member.organizationDetails?.[0]
          ? {
              _id: member.organizationDetails[0]._id,
              name: member.organizationDetails[0].name,
              code: member.organizationDetails[0].code,
            }
          : null,
        complaintsByStatus: undefined,
        complaintFeedbackStats: undefined,
        staffFeedbackStats: undefined,
        specializationDetails: undefined,
        organizationDetails: undefined,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        staff: formattedStaff,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all staff error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff members",
    });
  }
};

/**
 * @desc    Get available staff for assignment
 * @route   GET /api/admin/staff/available
 * @access  Private/Admin
 */
const getAvailableStaff = async (req, res) => {
  try {
    const { category } = req.query;

    console.log("=== GET AVAILABLE STAFF DEBUG ===");
    console.log(
      "User:",
      req.user?.email,
      "Organization:",
      req.user?.organization,
    );
    console.log("Category filter:", category);
    console.log("Request query:", req.query);

    // Check if user is authenticated and has organization
    if (!req.user) {
      console.log("ERROR: No user in request");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    let organizationId = req.user.organization;

    // If super_admin, allow organization from query
    if (req.user.role === "super_admin") {
      organizationId = req.query.organization || req.user.organization;
    }

    if (!organizationId) {
      console.log("ERROR: User has no organization and none provided in query");
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    console.log("Attempting to find available staff for org:", organizationId);

    // Get available staff with performance metrics
    const staff = await User.findAvailableStaff(
      organizationId,
      category || null,
    );

    console.log("Staff query completed, found:", staff.length, "members");

    if (!Array.isArray(staff)) {
      console.log("ERROR: Staff result is not an array:", typeof staff);
      return res.status(500).json({
        success: false,
        message: "Invalid staff data format",
      });
    }

    // Enhance with simple metrics (avoiding method calls that might not exist)
    const enhancedStaff = staff.map((member) => {
      try {
        // Use simple object conversion instead of potentially missing methods
        const memberObj = member.toObject ? member.toObject() : member;

        // Set safe defaults for performance metrics
        const performanceMetrics = {
          totalAssignments: memberObj.activeComplaintCount || 0,
          completionRate: 85, // Default value
          slaComplianceRate: 100,
          averageResolutionTime: 24,
          averageRating: 4.0,
          lastAssignmentDate: null,
          currentWorkload: memberObj.activeComplaintCount || 0,
          availabilityStatus: memberObj.isActive ? "online" : "offline",
          isOnline: memberObj.isActive || false,
        };

        return {
          ...memberObj,
          ...performanceMetrics,
          // Simple recommendation score based on availability
          recommendationScore: Math.max(
            0,
            100 - (memberObj.activeComplaintCount || 0) * 10,
          ),
          // Add formatted performance data
          avgRating: performanceMetrics.averageRating,
          avgResolutionTime: performanceMetrics.averageResolutionTime,
        };
      } catch (memberError) {
        console.error("Error processing staff member:", memberError);
        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          department: member.department,
          designation: member.designation,
          isActive: member.isActive,
          activeComplaintCount: 0,
          maxAssignedComplaints: 10,
          recommendationScore: 50,
          avgRating: 4.0,
          avgResolutionTime: 24,
        };
      }
    });

    // Sort by recommendation score (highest first)
    enhancedStaff.sort((a, b) => b.recommendationScore - a.recommendationScore);

    console.log(
      "Enhanced staff data prepared:",
      enhancedStaff.length,
      "members processed",
    );
    console.log(
      "Sample staff member:",
      enhancedStaff.length > 0
        ? {
            name: enhancedStaff[0].name,
            email: enhancedStaff[0].email,
            activeCount: enhancedStaff[0].activeComplaintCount,
            maxAssigned: enhancedStaff[0].maxAssignedComplaints,
          }
        : "No staff found",
    );

    console.log("=== END DEBUG ===");

    res.status(200).json({
      success: true,
      data: enhancedStaff,
      debug: {
        totalFound: staff.length,
        enhanced: enhancedStaff.length,
        organization: req.user.organization,
        category: category,
      },
    });
  } catch (error) {
    console.error("=== GET AVAILABLE STAFF ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    console.error("=== END ERROR ===");

    res.status(500).json({
      success: false,
      message: "Error fetching available staff",
      error: error.message,
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    });
  }
};

// Helper function to calculate recommendation score for staff assignment
function calculateRecommendationScore(staff, categoryId) {
  let score = 0;

  try {
    // Get performance metrics safely
    const performanceMetrics = staff.performanceMetrics || {};
    const staffStatus = staff.staffStatus || {};

    // Base score from SLA compliance (0-40 points)
    const slaCompliance = performanceMetrics.slaComplianceRate || 100;
    score += (slaCompliance / 100) * 40;

    // Average rating (0-20 points)
    const avgRating = performanceMetrics.averageRating || 0;
    score += (avgRating / 5) * 20;

    // Workload factor (0-20 points) - lower workload gets higher score
    const maxComplaints = staff.maxAssignedComplaints || 10;
    const currentWorkload = staffStatus.currentWorkload || 0;
    const workloadFactor = Math.max(
      0,
      (maxComplaints - currentWorkload) / maxComplaints,
    );
    score += workloadFactor * 20;

    // Specialization match (0-20 points)
    if (
      categoryId &&
      staff.specializations &&
      Array.isArray(staff.specializations)
    ) {
      const hasSpecialization = staff.specializations.some(
        (spec) => spec && spec.toString() === categoryId,
      );
      if (hasSpecialization) score += 20;
    }

    // Online status bonus
    if (staffStatus.isOnline) score += 5;
    if (staffStatus.availabilityStatus === "available") score += 5;
  } catch (error) {
    console.error("Error calculating recommendation score:", error);
    return 0;
  }

  return Math.round(Math.max(0, score));
}

/**
 * @desc    Get staff performance report
 * @route   GET /api/admin/staff/:id/performance
 * @access  Private/Admin
 */
const getStaffPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const staffQuery = {
      _id: id,
      role: "staff",
      ...(req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization }),
    };

    const staff = await User.findOne(staffQuery);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const dateMatch =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Get comprehensive statistics
    const [complaintStats, feedbackStats, resolutionTimeStats, monthlyTrend] =
      await Promise.all([
        // Complaint statistics
        Complaint.aggregate([
          {
            $match: {
              assignedTo: new mongoose.Types.ObjectId(id),
              ...dateMatch,
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
              escalated: {
                $sum: { $cond: [{ $eq: ["$status", "escalated"] }, 1, 0] },
              },
              slaBreached: {
                $sum: { $cond: ["$slaBreached", 1, 0] },
              },
              byPriority: {
                $push: "$priority",
              },
            },
          },
        ]),

        // Feedback statistics
        Feedback.getStaffStats(id),

        // Resolution time statistics
        Complaint.aggregate([
          {
            $match: {
              assignedTo: new mongoose.Types.ObjectId(id),
              "timeline.resolvedAt": { $exists: true },
              ...dateMatch,
            },
          },
          {
            $project: {
              resolutionTime: {
                $divide: [
                  {
                    $subtract: ["$timeline.resolvedAt", "$timeline.assignedAt"],
                  },
                  3600000, // Convert to hours
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTime: { $avg: "$resolutionTime" },
              minResolutionTime: { $min: "$resolutionTime" },
              maxResolutionTime: { $max: "$resolutionTime" },
            },
          },
        ]),

        // Monthly trend
        Complaint.aggregate([
          { $match: { assignedTo: new mongoose.Types.ObjectId(id) } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m", date: "$createdAt" },
              },
              assigned: { $sum: 1 },
              resolved: {
                $sum: {
                  $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
                },
              },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 12 },
        ]),
      ]);

    const stats = complaintStats[0] || {
      total: 0,
      resolved: 0,
      escalated: 0,
      slaBreached: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        staff: staff.toPublicProfile(),
        performance: {
          complaints: {
            total: stats.total,
            resolved: stats.resolved,
            escalated: stats.escalated,
            pending: stats.total - stats.resolved,
            resolutionRate:
              stats.total > 0
                ? Math.round((stats.resolved / stats.total) * 100)
                : 0,
            slaComplianceRate:
              stats.total > 0
                ? Math.round(
                    ((stats.total - stats.slaBreached) / stats.total) * 100,
                  )
                : 100,
          },
          feedback: feedbackStats,
          resolutionTime: resolutionTimeStats[0] || {
            avgResolutionTime: 0,
            minResolutionTime: 0,
            maxResolutionTime: 0,
          },
          monthlyTrend: monthlyTrend.reverse(),
        },
      },
    });
  } catch (error) {
    console.error("Get staff performance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff performance",
    });
  }
};

/**
 * @desc    Update staff status (activate/deactivate)
 * @route   PUT /api/admin/staff/:id/status
 * @access  Private/Admin
 */
const updateStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const staffQuery = {
      _id: id,
      role: "staff",
      ...(req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization }),
    };

    const staff = await User.findOne(staffQuery);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // If deactivating, check for active assignments
    if (!isActive) {
      const activeAssignments = await Complaint.countDocuments({
        assignedTo: id,
        status: { $in: ["assigned", "in-progress"] },
      });

      if (activeAssignments > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate staff with ${activeAssignments} active assignments. Please reassign first.`,
        });
      }
    }

    staff.isActive = isActive;
    await staff.save();

    res.status(200).json({
      success: true,
      message: `Staff member ${isActive ? "activated" : "deactivated"} successfully`,
      data: staff.toPublicProfile(),
    });
  } catch (error) {
    console.error("Update staff status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating staff status",
    });
  }
};

/**
 * @desc    Update staff specializations
 * @route   PUT /api/admin/staff/:id/specializations
 * @access  Private/Admin
 */
const updateStaffSpecializations = async (req, res) => {
  try {
    const { id } = req.params;
    const { specializations, maxAssignedComplaints } = req.body;

    const staffQuery = {
      _id: id,
      role: "staff",
      ...(req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization }),
    };

    const staff = await User.findOne(staffQuery);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    if (specializations) {
      // Validate categories exist
      const validCategories = await Category.find({
        _id: { $in: specializations },
        isActive: true,
      });

      staff.specializations = validCategories.map((c) => c._id);
    }

    if (maxAssignedComplaints !== undefined) {
      staff.maxAssignedComplaints = maxAssignedComplaints;
    }

    await staff.save();

    await staff.populate("specializations", "name color");

    res.status(200).json({
      success: true,
      message: "Staff specializations updated successfully",
      data: staff.toStaffProfile(),
    });
  } catch (error) {
    console.error("Update staff specializations error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating staff specializations",
    });
  }
};

/**
 * @desc    Close a complaint
 * @route   PUT /api/admin/complaints/:id/close
 * @access  Private/Admin
 */
const closeComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Role-based tenant boundary enforcement
    if (req.user.role !== "super_admin") {
      if (
        !req.user.organization ||
        !complaint.organization ||
        complaint.organization.toString() !== req.user.organization.toString()
      ) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
    }

    if (complaint.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Complaint is already closed",
      });
    }

    if (
      complaint.paymentWorkflow?.isPaymentRequested &&
      complaint.paymentWorkflow?.paymentStatus !== "acknowledged"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot close complaint yet. Staff must acknowledge completed payment first.",
        data: {
          paymentStatus: complaint.paymentWorkflow?.paymentStatus || "none",
        },
      });
    }

    complaint.status = "closed";
    complaint.timeline.closedAt = new Date();

    complaint.statusHistory.push({
      status: "closed",
      changedBy: req.user.id,
      changedByRole: "admin",
      remarks: remarks || "Closed by admin",
      changedAt: new Date(),
    });

    await complaint.save();

    // Notify user
    await notificationService.sendInAppFromTemplate({
      type: "complaint_closed",
      recipient: complaint.user,
      sender: req.user.id,
      complaint: complaint._id,
      customData: {
        complaintTitle: complaint.title,
        complaintId: complaint.complaintId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Complaint closed successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Close complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error closing complaint",
    });
  }
};

/**
 * @desc    Get staff feedback
 * @route   GET /api/admin/staff/:id/feedback
 * @access  Private/Admin
 */
const getStaffFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, category, feedbackType } = req.query;

    const staffQuery = {
      _id: id,
      role: "staff",
      ...(req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization }),
    };

    const staff = await User.findOne(staffQuery);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // Build query filters
    const query = { staffMember: id };

    if (category) {
      query.category = category;
    }

    if (feedbackType) {
      query.feedbackType = feedbackType;
    }

    // Get feedback with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedback, totalCount, stats] = await Promise.all([
      StaffFeedback.find(query)
        .populate("givenBy", "name email role")
        .populate("relatedComplaint", "complaintId title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),

      StaffFeedback.countDocuments(query),

      StaffFeedback.getDashboardStats(id),
    ]);

    // Calculate detailed statistics
    const detailedStats = await StaffFeedback.aggregate([
      { $match: { staffMember: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalCount: { $sum: 1 },
          ratingDistribution: {
            $push: "$rating",
          },
          categoryBreakdown: {
            $push: {
              category: "$category",
              rating: "$rating",
            },
          },
          typeBreakdown: {
            $push: {
              type: "$feedbackType",
              rating: "$rating",
            },
          },
        },
      },
    ]);

    let statistics = {
      averageRating: 0,
      totalCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryStats: {},
      typeStats: {},
    };

    if (detailedStats.length > 0) {
      const result = detailedStats[0];

      // Rating distribution
      const distribution = result.ratingDistribution.reduce(
        (acc, rating) => {
          acc[rating] = (acc[rating] || 0) + 1;
          return acc;
        },
        { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      );

      // Category breakdown
      const categoryStats = result.categoryBreakdown.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { total: 0, sum: 0, average: 0 };
        }
        acc[item.category].total++;
        acc[item.category].sum += item.rating;
        acc[item.category].average = Number(
          (acc[item.category].sum / acc[item.category].total).toFixed(1),
        );
        return acc;
      }, {});

      // Type breakdown
      const typeStats = result.typeBreakdown.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = { total: 0, sum: 0, average: 0 };
        }
        acc[item.type].total++;
        acc[item.type].sum += item.rating;
        acc[item.type].average = Number(
          (acc[item.type].sum / acc[item.type].total).toFixed(1),
        );
        return acc;
      }, {});

      statistics = {
        averageRating: Number(result.averageRating.toFixed(1)),
        totalCount: result.totalCount,
        distribution,
        categoryStats,
        typeStats,
      };
    }

    res.status(200).json({
      success: true,
      message: "Staff feedback retrieved successfully",
      data: feedback.map((f) => (f.isAnonymous ? f.toSafeObject() : f)),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: skip + parseInt(limit) < totalCount,
        hasPreviousPage: parseInt(page) > 1,
      },
      statistics,
    });
  } catch (error) {
    console.error("Get staff feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving staff feedback",
    });
  }
};

/**
 * @desc    Add staff feedback
 * @route   POST /api/admin/staff/:id/feedback
 * @access  Private/Admin
 */
const addStaffFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      rating,
      comment,
      category = "general",
      isAnonymous = false,
      relatedComplaint,
    } = req.body;

    const staffQuery = {
      _id: id,
      role: "staff",
      ...(req.user.role === "super_admin"
        ? {}
        : { organization: req.user.organization }),
    };

    const staff = await User.findOne(staffQuery);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // Validate related complaint if provided
    if (relatedComplaint) {
      const complaintQuery = {
        _id: relatedComplaint,
        assignedTo: id,
        ...(req.user.role === "super_admin"
          ? {}
          : { organization: req.user.organization }),
      };

      const complaint = await Complaint.findOne(complaintQuery);

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message:
            "Related complaint not found or not assigned to this staff member",
        });
      }
    }

    // Create feedback
    const feedback = new StaffFeedback({
      staffMember: id,
      givenBy: req.user.id,
      feedbackType: "admin",
      rating,
      comment,
      category,
      isAnonymous,
      relatedComplaint,
      metadata: {
        submissionSource: "admin_panel",
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
      },
    });

    await feedback.save();

    // Populate the feedback for response
    await feedback.populate([
      { path: "givenBy", select: "name email role" },
      { path: "relatedComplaint", select: "complaintId title" },
    ]);

    // Update staff statistics (you might want to trigger a cache refresh here)
    const updatedStats = await StaffFeedback.getDashboardStats(id);

    res.status(201).json({
      success: true,
      message: "Feedback added successfully",
      data: feedback.isAnonymous ? feedback.toSafeObject() : feedback,
      staffStats: updatedStats,
    });
  } catch (error) {
    console.error("Add staff feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding staff feedback",
    });
  }
};

/**
 * @desc    Get system analytics
 * @route   GET /api/admin/analytics
 * @access  Private/Admin
 */
const getAnalytics = async (req, res) => {
  try {
    const { period = "30d", organization: queryOrg } = req.query;

    // Tenant isolation scoping
    let targetOrgId = null;
    if (req.user.role === "super_admin") {
      if (queryOrg) {
        if (!mongoose.Types.ObjectId.isValid(queryOrg)) {
          return res.status(400).json({
            success: false,
            message: "Invalid organization ID format",
          });
        }
        targetOrgId = new mongoose.Types.ObjectId(queryOrg);
      }
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "User does not belong to any organization",
        });
      }
      targetOrgId = new mongoose.Types.ObjectId(req.user.organization);
    }

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

    // Complaint match filter (scoped by tenant and date)
    const complaintMatch = {
      createdAt: { $gte: startDate },
      ...(targetOrgId ? { organization: targetOrgId } : {}),
    };

    // Staff match filter (scoped by tenant)
    const staffMatch = {
      role: "staff",
      isActive: true,
      ...(targetOrgId ? { organization: targetOrgId } : {}),
    };

    const [
      complaintTrends,
      categoryBreakdown,
      staffPerformance,
      slaMetrics,
      feedbackTrends,
      peakHours,
    ] = await Promise.all([
      // Complaint trends over time
      Complaint.aggregate([
        { $match: complaintMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            submitted: { $sum: 1 },
            resolved: {
              $sum: { $cond: ["$timeline.resolvedAt", 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Category breakdown
      Complaint.aggregate([
        { $match: complaintMatch },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
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
                    $subtract: [
                      "$timeline.resolvedAt",
                      "$timeline.submittedAt",
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
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
            resolved: 1,
            avgResolutionHours: {
              $divide: ["$avgResolutionTime", 3600000],
            },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top performing staff
      User.aggregate([
        { $match: staffMatch },
        {
          $lookup: {
            from: "complaints",
            let: { staffId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$assignedTo", "$$staffId"] },
                  createdAt: { $gte: startDate },
                  ...(targetOrgId ? { organization: targetOrgId } : {}),
                },
              },
            ],
            as: "complaints",
          },
        },
        {
          $project: {
            name: 1,
            department: 1,
            totalComplaints: { $size: "$complaints" },
            resolvedComplaints: {
              $size: {
                $filter: {
                  input: "$complaints",
                  as: "c",
                  cond: { $in: ["$$c.status", ["resolved", "closed"]] },
                },
              },
            },
          },
        },
        {
          $addFields: {
            resolutionRate: {
              $cond: [
                { $gt: ["$totalComplaints", 0] },
                {
                  $multiply: [
                    { $divide: ["$resolvedComplaints", "$totalComplaints"] },
                    100,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { resolvedComplaints: -1 } },
        { $limit: 10 },
      ]),

      // SLA metrics
      Complaint.aggregate([
        { $match: complaintMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
            onTime: { $sum: { $cond: ["$slaBreached", 0, 1] } },
          },
        },
        {
          $project: {
            total: 1,
            breached: 1,
            onTime: 1,
            slaComplianceRate: {
              $multiply: [{ $divide: ["$onTime", "$total"] }, 100],
            },
          },
        },
      ]),

      // Feedback trends
      Feedback.aggregate([
        {
          $lookup: {
            from: "complaints",
            localField: "complaint",
            foreignField: "_id",
            as: "complaintInfo",
          },
        },
        { $unwind: "$complaintInfo" },
        {
          $match: {
            createdAt: { $gte: startDate },
            ...(targetOrgId
              ? { "complaintInfo.organization": targetOrgId }
              : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Peak hours analysis
      Complaint.aggregate([
        { $match: complaintMatch },
        {
          $group: {
            _id: { $hour: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: { days: daysBack, startDate },
        complaintTrends,
        categoryBreakdown,
        staffPerformance,
        slaMetrics: slaMetrics[0] || {
          total: 0,
          breached: 0,
          onTime: 0,
          slaComplianceRate: 100,
        },
        feedbackTrends,
        peakHours,
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics",
    });
  }
};

/**
 * @desc    Export complaints data
 * @route   GET /api/admin/export/complaints
 * @access  Private/Admin
 */
const exportComplaints = async (req, res) => {
  try {
    const {
      format = "json",
      status,
      startDate,
      endDate,
      organization: queryOrg,
    } = req.query;

    const query = {};

    // Organization scoping
    if (req.user.role === "super_admin") {
      if (queryOrg) {
        if (!mongoose.Types.ObjectId.isValid(queryOrg)) {
          return res.status(400).json({
            success: false,
            message: "Invalid organization ID format",
          });
        }
        query.organization = new mongoose.Types.ObjectId(queryOrg);
      }
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "User does not belong to any organization",
        });
      }
      query.organization = new mongoose.Types.ObjectId(req.user.organization);
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const complaints = await Complaint.find(query)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "Complaint ID",
        "Title",
        "Category",
        "Priority",
        "Status",
        "Submitted By",
        "Assigned To",
        "Created At",
        "Resolved At",
        "SLA Breached",
      ];

      const rows = complaints.map((c) => [
        c.complaintId,
        `"${c.title.replace(/"/g, '""')}"`,
        c.category?.name || "",
        c.priority,
        c.status,
        c.user?.name || "",
        c.assignedTo?.name || "",
        new Date(c.createdAt).toISOString(),
        c.timeline?.resolvedAt
          ? new Date(c.timeline.resolvedAt).toISOString()
          : "",
        c.slaBreached ? "Yes" : "No",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n",
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=complaints.csv",
      );
      return res.send(csv);
    }

    res.status(200).json({
      success: true,
      data: complaints,
    });
  } catch (error) {
    console.error("Export complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting complaints",
    });
  }
};

/**
 * @desc    Create announcement
 * @route   POST /api/admin/announcements
 * @access  Private/Admin
 */
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRole, priority = "normal" } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // Get target users
    const userQuery = { isActive: true };
    if (targetRole && targetRole !== "all") {
      userQuery.role = targetRole;
    }

    const users = await User.find(userQuery).select("_id");
    const userIds = users.map((u) => u._id);

    // Create bulk notifications
    await notificationService.sendBulkInAppNotifications(userIds, {
      type: "system_announcement",
      title,
      message,
      priority,
      sender: req.user.id,
      metadata: { isAnnouncement: true },
    });

    res.status(201).json({
      success: true,
      message: `Announcement sent to ${userIds.length} users`,
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating announcement",
    });
  }
};

/**
 * @desc    Get comprehensive reports
 * @route   GET /api/admin/reports
 * @access  Private/Admin
 */
const getReports = async (req, res) => {
  try {
    const { startDate, endDate, category, priority, status } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Organization filter
    let orgFilter = {};
    if (req.user.role !== "super_admin") {
      orgFilter = { organization: req.user.organization };
    }

    // Additional filters
    const additionalFilters = {};
    if (category) additionalFilters.category = category;
    if (priority) additionalFilters.priority = priority;
    if (status) additionalFilters.status = status;

    const dateMatch =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
    const baseFilter = { ...orgFilter, ...additionalFilters, ...dateMatch };

    // Overview data
    const [
      totalComplaints,
      resolvedComplaints,
      escalatedComplaints,
      avgResolutionTime,
      satisfactionScore,
      dailyTrend,
      previousPeriod,
    ] = await Promise.all([
      Complaint.countDocuments(baseFilter),
      Complaint.countDocuments({ ...baseFilter, status: "resolved" }),
      Complaint.countDocuments({ ...baseFilter, status: "escalated" }),

      // Average resolution time
      Complaint.aggregate([
        {
          $match: {
            ...baseFilter,
            status: "resolved",
            resolvedAt: { $ne: null },
          },
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ["$resolvedAt", "$createdAt"] },
                1000 * 60 * 60, // Convert to hours
              ],
            },
          },
        },
        { $group: { _id: null, avgTime: { $avg: "$resolutionTime" } } },
      ]),

      // Satisfaction score from feedback
      Feedback.aggregate([
        {
          $lookup: {
            from: "complaints",
            localField: "complaint",
            foreignField: "_id",
            as: "complaintInfo",
          },
        },
        { $unwind: "$complaintInfo" },
        { $match: { ...orgFilter, createdAt: dateFilter } },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } },
      ]),

      // Daily trend data
      Complaint.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
            },
            submitted: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
            },
          },
        },
        { $sort: { "_id.date": 1 } },
        { $project: { date: "$_id.date", submitted: 1, resolved: 1, _id: 0 } },
      ]),

      // Previous period for comparison (same duration, earlier period)
      (() => {
        const prevDateFilter = {};
        if (startDate && endDate) {
          const duration = new Date(endDate) - new Date(startDate);
          const prevEndDate = new Date(startDate);
          const prevStartDate = new Date(prevEndDate.getTime() - duration);
          prevDateFilter.createdAt = { $gte: prevStartDate, $lte: prevEndDate };
        }
        const prevFilter = {
          ...orgFilter,
          ...additionalFilters,
          ...prevDateFilter,
        };

        return Promise.all([
          Complaint.countDocuments(prevFilter),
          Complaint.countDocuments({ ...prevFilter, status: "resolved" }),
          Complaint.aggregate([
            {
              $match: {
                ...prevFilter,
                status: "resolved",
                resolvedAt: { $ne: null },
              },
            },
            {
              $project: {
                resolutionTime: {
                  $divide: [
                    { $subtract: ["$resolvedAt", "$createdAt"] },
                    1000 * 60 * 60,
                  ],
                },
              },
            },
            { $group: { _id: null, avgTime: { $avg: "$resolutionTime" } } },
          ]),
        ]);
      })(),
    ]);

    // Trends data
    const [monthlyData, responseTimeData] = await Promise.all([
      Complaint.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            },
            submitted: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
            },
            escalated: {
              $sum: { $cond: [{ $eq: ["$status", "escalated"] }, 1, 0] },
            },
          },
        },
        { $sort: { "_id.month": 1 } },
        {
          $project: {
            month: "$_id.month",
            submitted: 1,
            resolved: 1,
            escalated: 1,
            _id: 0,
          },
        },
      ]),

      Complaint.aggregate([
        { $match: { ...baseFilter, firstResponse: { $ne: null } } },
        {
          $project: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            responseTime: {
              $divide: [
                { $subtract: ["$firstResponse", "$createdAt"] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: "$date",
            avgResponseTime: { $avg: "$responseTime" },
            slaTarget: { $first: 24 }, // 24 hour SLA target
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: { date: "$_id", avgResponseTime: 1, slaTarget: 1, _id: 0 },
        },
      ]),
    ]);

    // Performance data
    const [topStaff, priorityData] = await Promise.all([
      User.aggregate([
        { $match: { role: "staff", ...orgFilter } },
        {
          $lookup: {
            from: "complaints",
            localField: "_id",
            foreignField: "assignedTo",
            as: "assignedComplaints",
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            resolvedComplaints: {
              $filter: {
                input: "$assignedComplaints",
                cond: { $eq: ["$$this.status", "resolved"] },
              },
            },
            totalAssigned: { $size: "$assignedComplaints" },
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            resolvedCount: { $size: "$resolvedComplaints" },
            totalAssigned: 1,
            avgResolutionTime: {
              $avg: "$resolvedComplaints.resolutionTimeHours",
            },
          },
        },
        { $match: { resolvedCount: { $gt: 0 } } },
        { $sort: { resolvedCount: -1 } },
        { $limit: 10 },
      ]),

      Complaint.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: "$priority",
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            priority: "$_id",
            total: 1,
            resolved: 1,
            rate: {
              $cond: [
                { $eq: ["$total", 0] },
                0,
                { $multiply: [{ $divide: ["$resolved", "$total"] }, 100] },
              ],
            },
          },
        },
      ]),
    ]);

    // Categories data
    const [categoryDistribution, categoryPerformance, categoryTrendData] =
      await Promise.all([
        Category.aggregate([
          { $match: orgFilter },
          {
            $lookup: {
              from: "complaints",
              localField: "_id",
              foreignField: "category",
              as: "complaints",
            },
          },
          {
            $project: {
              name: 1,
              count: {
                $size: {
                  $filter: {
                    input: "$complaints",
                    cond: {
                      $and: [
                        dateFilter.createdAt
                          ? {
                              $gte: [
                                "$$this.createdAt",
                                dateFilter.createdAt.$gte,
                              ],
                            }
                          : true,
                        dateFilter.createdAt
                          ? {
                              $lte: [
                                "$$this.createdAt",
                                dateFilter.createdAt.$lte,
                              ],
                            }
                          : true,
                      ].filter(Boolean),
                    },
                  },
                },
              },
            },
          },
          { $match: { count: { $gt: 0 } } },
          { $sort: { count: -1 } },
        ]),

        Category.aggregate([
          { $match: orgFilter },
          {
            $lookup: {
              from: "complaints",
              localField: "_id",
              foreignField: "category",
              as: "complaints",
            },
          },
          {
            $project: {
              name: 1,
              totalComplaints: { $size: "$complaints" },
              resolvedComplaints: {
                $size: {
                  $filter: {
                    input: "$complaints",
                    cond: { $eq: ["$$this.status", "resolved"] },
                  },
                },
              },
              avgResolutionTime: { $avg: "$complaints.resolutionTimeHours" },
            },
          },
          {
            $project: {
              name: 1,
              totalComplaints: 1,
              resolvedComplaints: 1,
              resolutionRate: {
                $cond: [
                  { $eq: ["$totalComplaints", 0] },
                  0,
                  {
                    $multiply: [
                      { $divide: ["$resolvedComplaints", "$totalComplaints"] },
                      100,
                    ],
                  },
                ],
              },
              avgResolutionTime: { $ifNull: ["$avgResolutionTime", 0] },
            },
          },
          { $match: { totalComplaints: { $gt: 0 } } },
          { $sort: { resolutionRate: -1 } },
        ]),

        // Category trend over time
        Complaint.aggregate([
          { $match: baseFilter },
          {
            $lookup: {
              from: "categories",
              localField: "category",
              foreignField: "_id",
              as: "categoryInfo",
            },
          },
          { $unwind: "$categoryInfo" },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                category: "$categoryInfo.name",
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.date",
              categories: {
                $push: {
                  k: "$_id.category",
                  v: "$count",
                },
              },
            },
          },
          {
            $project: {
              date: "$_id",
              categoryData: { $arrayToObject: "$categories" },
              _id: 0,
            },
          },
          { $sort: { date: 1 } },
        ]),
      ]);

    const reports = {
      overview: {
        totalComplaints,
        resolvedComplaints,
        escalatedComplaints,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0,
        satisfactionScore: satisfactionScore[0]?.avgRating * 20 || 0, // Convert 5-star to percentage
        dailyTrend,
        previousTotal: previousPeriod[0] || 0,
        previousResolved: previousPeriod[1] || 0,
        previousAvgTime: previousPeriod[2][0]?.avgTime || 0,
        previousSatisfaction: 0, // Would need separate query for previous period feedback
      },
      trends: {
        monthlyData,
        responseTimeData,
      },
      performance: {
        topStaff: topStaff.map((staff) => ({
          ...staff,
          avgResolutionTime: staff.avgResolutionTime || 0,
        })),
        priorityData,
      },
      categories: {
        distribution: categoryDistribution,
        performance: categoryPerformance,
        trendData: categoryTrendData,
      },
    };

    res.json({
      success: true,
      data: reports,
    });
  } catch (err) {
    console.error("Get reports error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate reports",
      error: err.message,
    });
  }
};

/**
 * @desc    Export reports in various formats
 * @route   GET /api/admin/reports/export
 * @access  Private/Admin
 */
const exportReports = async (req, res) => {
  try {
    const { format = "json", startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const orgFilter =
      req.user.role !== "super_admin"
        ? { organization: req.user.organization }
        : {};

    const matchFilter = {
      ...orgFilter,
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const [
      totalComplaints,
      resolvedComplaints,
      escalatedComplaints,
      categoryStats,
    ] = await Promise.all([
      Complaint.countDocuments(matchFilter),
      Complaint.countDocuments({ ...matchFilter, status: "resolved" }),
      Complaint.countDocuments({ ...matchFilter, status: "escalated" }),
      Complaint.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        { $unwind: "$categoryInfo" },
        { $group: { _id: "$categoryInfo.name", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const exportData = {
      generatedAt: new Date().toISOString(),
      dateRange: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalComplaints,
        resolvedComplaints,
        escalatedComplaints,
      },
      categories: categoryStats,
    };

    if (format === "csv") {
      const summaryRows = [
        ["Metric", "Value"],
        ["Total Complaints", totalComplaints],
        ["Resolved Complaints", resolvedComplaints],
        ["Escalated Complaints", escalatedComplaints],
      ];

      const categoryRows = [
        ["Category", "Count"],
        ...categoryStats.map((row) => [row._id, row.count]),
      ];

      const csv = [
        ...summaryRows.map((row) => row.join(",")),
        "",
        ...categoryRows.map((row) => row.join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=reports-${Date.now()}.csv`,
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40 });
      const filename = `reports-${Date.now()}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      doc.pipe(res);

      doc.fontSize(18).text("Complaint Resolution Report", { underline: true });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .text(
          `Generated At: ${new Date(exportData.generatedAt).toISOString()}`,
        );
      doc
        .fontSize(10)
        .text(
          `Date Range: ${exportData.dateRange.startDate || "N/A"} to ${exportData.dateRange.endDate || "N/A"}`,
        );

      doc.moveDown();
      doc.fontSize(14).text("Summary");
      doc.fontSize(11).text(`Total Complaints: ${totalComplaints}`);
      doc.fontSize(11).text(`Resolved Complaints: ${resolvedComplaints}`);
      doc.fontSize(11).text(`Escalated Complaints: ${escalatedComplaints}`);

      doc.moveDown();
      doc.fontSize(14).text("Category Breakdown");

      if (!categoryStats.length) {
        doc.fontSize(11).text("No category data available.");
      } else {
        categoryStats.forEach((row, index) => {
          doc
            .fontSize(11)
            .text(`${index + 1}. ${row._id || "Uncategorized"}: ${row.count}`);
        });
      }

      doc.end();
      return;
    }

    return res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (err) {
    console.error("Export reports error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to export reports",
      error: err.message,
    });
  }
};

const parseCsvText = (csvText = "") => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const parseRow = (line) =>
    line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((value) => value.trim().replace(/^"|"$/g, ""));

  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
};

const importUsersCsv = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows
      : parseCsvText(req.body.csv || "");

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No rows found for import",
      });
    }

    const orgId =
      req.user.role === "super_admin" ? null : req.user.organization;
    let inserted = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      try {
        if (!row.email || !row.name) {
          throw new Error("Missing required fields: name/email");
        }

        const existing = await User.findOne({ email: row.email.toLowerCase() });
        if (existing) {
          continue;
        }

        await User.create({
          name: row.name,
          email: row.email.toLowerCase(),
          password: row.password || "Temp@1234",
          role: row.role || "user",
          department: row.department || undefined,
          organization: row.organization || orgId,
        });
        inserted += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "User import completed",
      data: { totalRows: rows.length, inserted, failed: errors.length, errors },
    });
  } catch (error) {
    console.error("Import users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import users",
    });
  }
};

const importCategoriesCsv = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows
      : parseCsvText(req.body.csv || "");

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No rows found for import",
      });
    }

    const orgId =
      req.user.role === "super_admin"
        ? req.body.organization
        : req.user.organization;
    let inserted = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      try {
        if (!row.name) {
          throw new Error("Missing required field: name");
        }

        const exists = await Category.findOne({
          name: row.name,
          organization: orgId,
        });
        if (exists) {
          continue;
        }

        await Category.create({
          name: row.name,
          description: row.description || "",
          department: row.department || "General",
          defaultPriority: row.defaultPriority || "medium",
          organization: orgId,
          createdBy: req.user.id,
        });
        inserted += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Category import completed",
      data: { totalRows: rows.length, inserted, failed: errors.length, errors },
    });
  } catch (error) {
    console.error("Import categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import categories",
    });
  }
};

const importComplaintsCsv = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows
      : parseCsvText(req.body.csv || "");

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No rows found for import",
      });
    }

    const orgId =
      req.user.role === "super_admin"
        ? req.body.organization
        : req.user.organization;
    let inserted = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      try {
        const title = row.title || row.subject;
        const description = row.description;
        const userEmail = (row.userEmail || row.email || "").toLowerCase();
        const categoryName = row.category;

        if (!title || !description || !userEmail || !categoryName) {
          throw new Error(
            "Missing required fields: title/description/userEmail/category",
          );
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
          throw new Error(`User not found: ${userEmail}`);
        }

        const category = await Category.findOne({
          name: categoryName,
          organization: orgId,
        });
        if (!category) {
          throw new Error(`Category not found: ${categoryName}`);
        }

        await Complaint.create({
          title,
          description,
          user: user._id,
          category: category._id,
          priority: row.priority || "medium",
          organization: orgId,
          status: row.status || "new",
        });

        inserted += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Complaint import completed",
      data: { totalRows: rows.length, inserted, failed: errors.length, errors },
    });
  } catch (error) {
    console.error("Import complaints error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import complaints",
    });
  }
};

const getAnalyticsTrends = async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || 30, 10), 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orgFilter =
      req.user.role !== "super_admin"
        ? { organization: new mongoose.Types.ObjectId(req.user.organization) }
        : {};

    const trends = await Complaint.aggregate([
      { $match: { ...orgFilter, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: { periodDays: days, trends },
    });
  } catch (error) {
    console.error("Get analytics trends error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trend analytics",
    });
  }
};

const getAnalyticsForecast = async (req, res) => {
  try {
    const lookbackDays = 14;
    const forecastDays = Math.max(parseInt(req.query.days || 7, 10), 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const orgFilter =
      req.user.role !== "super_admin"
        ? { organization: new mongoose.Types.ObjectId(req.user.organization) }
        : {};

    const dailyCounts = await Complaint.aggregate([
      { $match: { ...orgFilter, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const avgPerDay = dailyCounts.length
      ? dailyCounts.reduce((acc, day) => acc + day.count, 0) /
        dailyCounts.length
      : 0;

    const forecast = Array.from({ length: forecastDays }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index + 1);
      return {
        date: date.toISOString().split("T")[0],
        forecastCount: Math.round(avgPerDay),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        basedOnDays: lookbackDays,
        averagePerDay: Number(avgPerDay.toFixed(2)),
        forecast,
      },
    });
  } catch (error) {
    console.error("Get analytics forecast error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch forecast analytics",
    });
  }
};

const getAnalyticsComparison = async (req, res) => {
  try {
    const currentStart = req.query.currentStart
      ? new Date(req.query.currentStart)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const currentEnd = req.query.currentEnd
      ? new Date(req.query.currentEnd)
      : new Date();

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart);
    const previousStart = new Date(previousEnd.getTime() - durationMs);

    const orgFilter =
      req.user.role !== "super_admin"
        ? { organization: new mongoose.Types.ObjectId(req.user.organization) }
        : {};

    const [currentTotal, previousTotal, currentResolved, previousResolved] =
      await Promise.all([
        Complaint.countDocuments({
          ...orgFilter,
          createdAt: { $gte: currentStart, $lte: currentEnd },
        }),
        Complaint.countDocuments({
          ...orgFilter,
          createdAt: { $gte: previousStart, $lte: previousEnd },
        }),
        Complaint.countDocuments({
          ...orgFilter,
          status: "resolved",
          createdAt: { $gte: currentStart, $lte: currentEnd },
        }),
        Complaint.countDocuments({
          ...orgFilter,
          status: "resolved",
          createdAt: { $gte: previousStart, $lte: previousEnd },
        }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        current: { total: currentTotal, resolved: currentResolved },
        previous: { total: previousTotal, resolved: previousResolved },
      },
    });
  } catch (error) {
    console.error("Get analytics comparison error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch comparison analytics",
    });
  }
};

const getAnalyticsHeatmap = async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || 30, 10), 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orgFilter =
      req.user.role !== "super_admin"
        ? { organization: new mongoose.Types.ObjectId(req.user.organization) }
        : {};

    const heatmap = await Complaint.aggregate([
      { $match: { ...orgFilter, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$createdAt" },
            hourOfDay: { $hour: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.dayOfWeek": 1, "_id.hourOfDay": 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        periodDays: days,
        heatmap,
      },
    });
  } catch (error) {
    console.error("Get analytics heatmap error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch heatmap analytics",
    });
  }
};

/**
 * @desc    Create a new organization
 * @route   POST /api/admin/organizations
 * @access  Private/SuperAdmin
 */
const createOrganization = async (req, res) => {
  try {
    const { name, email, address, settings } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const Organization = require("../models/Organization"); // Ensure model is available

    // Check if org with same name exists
    const existingOrg = await Organization.findOne({ name });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: "Organization with this name already exists",
      });
    }

    // Generate unique code
    let code =
      name
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, "X") + "-";
    const crypto = require("crypto");
    code += crypto.randomBytes(3).toString("hex").toUpperCase();

    const organization = await Organization.create({
      name,
      email,
      address,
      code,
      settings: settings || {},
      status: "active",
    });

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: organization,
    });
  } catch (error) {
    console.error("Create organization error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating organization",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get all organizations
 * @route   GET /api/admin/organizations
 * @access  Private/SuperAdmin
 */
const getAllOrganizations = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const Organization = require("../models/Organization");

    const [organizations, total] = await Promise.all([
      Organization.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Organization.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        organizations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all organizations error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllComplaints,
  getUnassignedComplaints,
  assignComplaint,
  reassignComplaint,
  bulkAssignComplaints,
  getEscalatedComplaints,
  escalateComplaint,
  getAllStaff,
  getAvailableStaff,
  getStaffPerformance,
  updateStaffStatus,
  updateStaffSpecializations,
  getStaffFeedback,
  addStaffFeedback,
  closeComplaint,
  getAnalytics,
  exportComplaints,
  createAnnouncement,
  getReports,
  exportReports,
  importUsersCsv,
  importComplaintsCsv,
  importCategoriesCsv,
  getAnalyticsTrends,
  getAnalyticsForecast,
  getAnalyticsComparison,
  getAnalyticsHeatmap,
  getAllUsers,
  createOrganization, // New
  getAllOrganizations, // New
};
