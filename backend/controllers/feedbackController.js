/**
 * Feedback Controller
 *
 * Handles feedback submission and retrieval operations:
 * - Submit feedback for resolved complaints
 * - View feedback history
 * - Admin feedback analytics
 * - Feedback management
 */

const Feedback = require("../models/Feedback");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

/**
 * @desc    Submit feedback for a resolved complaint
 * @route   POST /api/feedback
 * @access  Private/User
 */
const submitFeedback = async (req, res) => {
  try {
    const {
      complaintId,
      rating,
      comments,
      ratingBreakdown,
      wouldRecommend,
      positiveAspects,
      improvementAreas,
      issueResolved,
      needsFollowUp,
      followUpReason,
      isAnonymous,
    } = req.body;

    // Validate required fields
    if (!complaintId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Complaint ID and rating are required",
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Find the complaint
    const complaint = await Complaint.findById(complaintId).populate(
      "assignedTo",
      "name email",
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify ownership
    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only provide feedback for your own complaints",
      });
    }

    // Verify complaint is resolved
    if (!["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Feedback can only be submitted for resolved or closed complaints",
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ complaint: complaintId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: "Feedback has already been submitted for this complaint",
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      complaint: complaintId,
      user: req.user.id,
      resolvedBy: complaint.assignedTo?._id,
      rating,
      comments,
      ratingBreakdown,
      wouldRecommend,
      positiveAspects,
      improvementAreas,
      issueResolved: issueResolved !== undefined ? issueResolved : true,
      needsFollowUp: needsFollowUp || false,
      followUpReason,
      isAnonymous: isAnonymous || false,
      reviewStatus: "approved", // Auto-approve for now
    });

    // Update complaint with feedback reference
    complaint.feedback = feedback._id;
    complaint.resolution.satisfaction =
      rating >= 4 ? "satisfied" : "unsatisfied";
    await complaint.save();

    // Notify staff about feedback
    if (complaint.assignedTo) {
      await Notification.createFromTemplate({
        type: "feedback_received",
        recipient: complaint.assignedTo._id,
        sender: isAnonymous ? null : req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
          rating,
          isAnonymous,
        },
      });
    }

    // Handle follow-up request
    if (needsFollowUp) {
      // Notify admin about follow-up request
      const admins = await mongoose
        .model("User")
        .find({ role: { $in: ["admin", "org_admin", "super_admin"] }, isActive: true });

      for (const admin of admins) {
        await Notification.create({
          recipient: admin._id,
          type: "feedback_received",
          title: "Follow-up Requested",
          message: `User has requested follow-up for complaint "${complaint.complaintId}". Reason: ${followUpReason || "Not specified"}`,
          priority: "high",
          relatedComplaint: complaint._id,
          actionUrl: `/admin/complaints/${complaint._id}`,
        });
      }
    }

    // Populate and return
    await feedback.populate([
      { path: "complaint", select: "complaintId title" },
    ]);

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      data: feedback,
    });
  } catch (error) {
    console.error("Submit feedback error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Feedback has already been submitted for this complaint",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error submitting feedback",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get feedback for a specific complaint
 * @route   GET /api/feedback/complaint/:complaintId
 * @access  Private
 */
const getFeedbackByComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const feedback = await Feedback.findOne({ complaint: complaintId })
      .populate("user", "name email avatar")
      .populate("resolvedBy", "name email")
      .populate("complaint", "complaintId title status");

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "No feedback found for this complaint",
      });
    }

    // Check authorization
    const complaint = await Complaint.findById(complaintId);
    const isOwner = complaint.user.toString() === req.user.id;
    const isAssignee = complaint.assignedTo?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAssignee && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this feedback",
      });
    }

    // If anonymous and not admin, hide user info
    let responseData = feedback.toObject();
    if (feedback.isAnonymous && !isAdmin) {
      responseData.user = null;
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get feedback by complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback",
    });
  }
};

/**
 * @desc    Get user's feedback history
 * @route   GET /api/feedback/my-feedback
 * @access  Private/User
 */
const getMyFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total] = await Promise.all([
      Feedback.find({ user: req.user.id })
        .populate("complaint", "complaintId title status category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Feedback.countDocuments({ user: req.user.id }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
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
      message: "Error fetching feedback history",
    });
  }
};

/**
 * @desc    Get all feedback (admin)
 * @route   GET /api/feedback
 * @access  Private/Admin
 */
const getAllFeedback = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      rating,
      startDate,
      endDate,
      staffId,
      reviewStatus,
      needsFollowUp,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (rating) {
      query.rating = parseInt(rating);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (staffId) {
      query.resolvedBy = staffId;
    }

    if (reviewStatus) {
      query.reviewStatus = reviewStatus;
    }

    if (needsFollowUp === "true") {
      query.needsFollowUp = true;
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total] = await Promise.all([
      Feedback.find(query)
        .populate("user", "name email")
        .populate("resolvedBy", "name email department")
        .populate("complaint", "complaintId title category")
        .populate("adminResponse.respondedBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Feedback.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback",
    });
  }
};

/**
 * @desc    Get feedback statistics
 * @route   GET /api/feedback/stats
 * @access  Private/Admin
 */
const getFeedbackStats = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    if (staffId) {
      matchStage.resolvedBy = new mongoose.Types.ObjectId(staffId);
    }

    const [
      overallStats,
      ratingDistribution,
      satisfactionTrend,
      improvementAreas,
      positiveAspects,
      staffRankings,
    ] = await Promise.all([
      // Overall statistics
      Feedback.getOverallStats(dateFilter),

      // Rating distribution
      Feedback.aggregate([
        { $match: matchStage },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Satisfaction trend over time
      Feedback.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
            satisfied: {
              $sum: {
                $cond: [{ $gte: ["$rating", 4] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),

      // Top improvement areas
      Feedback.getImprovementAnalysis(),

      // Top positive aspects
      Feedback.getPositiveAnalysis(),

      // Staff rankings by feedback
      Feedback.aggregate([
        { $match: { ...matchStage, resolvedBy: { $exists: true } } },
        {
          $group: {
            _id: "$resolvedBy",
            avgRating: { $avg: "$rating" },
            totalFeedbacks: { $sum: 1 },
            fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "staffInfo",
          },
        },
        { $unwind: "$staffInfo" },
        {
          $project: {
            name: "$staffInfo.name",
            department: "$staffInfo.department",
            avgRating: { $round: ["$avgRating", 2] },
            totalFeedbacks: 1,
            fiveStars: 1,
          },
        },
        { $sort: { avgRating: -1, totalFeedbacks: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Format rating distribution
    const formattedDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    ratingDistribution.forEach((item) => {
      formattedDistribution[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        overview: overallStats,
        ratingDistribution: formattedDistribution,
        satisfactionTrend,
        improvementAreas,
        positiveAspects,
        staffRankings,
      },
    });
  } catch (error) {
    console.error("Get feedback stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback statistics",
    });
  }
};

/**
 * @desc    Get staff feedback (for staff member)
 * @route   GET /api/feedback/staff/my-feedback
 * @access  Private/Staff
 */
const getStaffFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total, stats] = await Promise.all([
      Feedback.find({ resolvedBy: req.user.id })
        .populate("complaint", "complaintId title")
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Feedback.countDocuments({ resolvedBy: req.user.id }),
      Feedback.getStaffStats(req.user.id),
    ]);

    // Mask user info for anonymous feedback
    const maskedFeedbacks = feedbacks.map((fb) => {
      const obj = fb.toObject();
      if (fb.isAnonymous) {
        obj.user = null;
      }
      return obj;
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
    console.error("Get staff feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback",
    });
  }
};

/**
 * @desc    Add admin response to feedback
 * @route   POST /api/feedback/:id/respond
 * @access  Private/Admin
 */
const respondToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        message: "Response is required",
      });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    feedback.addAdminResponse(response, req.user.id);
    await feedback.save();

    // Notify user about response
    if (!feedback.isAnonymous) {
      await Notification.create({
        recipient: feedback.user,
        type: "feedback_received",
        title: "Response to Your Feedback",
        message: "An administrator has responded to your feedback.",
        priority: "normal",
        relatedComplaint: feedback.complaint,
        relatedFeedback: feedback._id,
        actionUrl: `/complaints/${feedback.complaint}`,
      });
    }

    await feedback.populate([
      { path: "adminResponse.respondedBy", select: "name" },
    ]);

    res.status(200).json({
      success: true,
      message: "Response added successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Respond to feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding response",
    });
  }
};

/**
 * @desc    Flag feedback for review
 * @route   PUT /api/feedback/:id/flag
 * @access  Private/Admin
 */
const flagFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Flag reason is required",
      });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    feedback.flag(reason);
    await feedback.save();

    res.status(200).json({
      success: true,
      message: "Feedback flagged for review",
      data: feedback,
    });
  } catch (error) {
    console.error("Flag feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error flagging feedback",
    });
  }
};

/**
 * @desc    Update feedback review status
 * @route   PUT /api/feedback/:id/review
 * @access  Private/Admin
 */
const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      {
        reviewStatus: status,
        isFlagged: status === "rejected",
      },
      { new: true },
    );

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Review status updated",
      data: feedback,
    });
  } catch (error) {
    console.error("Update review status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating review status",
    });
  }
};

/**
 * @desc    Get pending feedback requests
 * @route   GET /api/feedback/pending-requests
 * @access  Private/User
 */
const getPendingFeedbackRequests = async (req, res) => {
  try {
    // Find resolved/closed complaints without feedback
    const complaintsWithoutFeedback = await Complaint.find({
      user: req.user.id,
      status: { $in: ["resolved", "closed"] },
      feedback: { $exists: false },
    })
      .populate("category", "name")
      .populate("assignedTo", "name")
      .sort({ "timeline.resolvedAt": -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        count: complaintsWithoutFeedback.length,
        complaints: complaintsWithoutFeedback,
      },
    });
  } catch (error) {
    console.error("Get pending feedback requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending feedback requests",
    });
  }
};

/**
 * @desc    Check if feedback exists for complaint
 * @route   GET /api/feedback/check/:complaintId
 * @access  Private
 */
const checkFeedbackExists = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const feedback = await Feedback.findOne({ complaint: complaintId });

    res.status(200).json({
      success: true,
      data: {
        exists: !!feedback,
        feedbackId: feedback?._id || null,
      },
    });
  } catch (error) {
    console.error("Check feedback exists error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking feedback status",
    });
  }
};

/**
 * @desc    Get feedback trends
 * @route   GET /api/feedback/trends
 * @access  Private/Admin
 */
const getFeedbackTrends = async (req, res) => {
  try {
    const { period = "month", limit = 12 } = req.query;

    const trends = await Feedback.getTrends(period, parseInt(limit));

    res.status(200).json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error("Get feedback trends error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching feedback trends",
    });
  }
};

/**
 * @desc    Delete feedback (admin only, soft delete or special cases)
 * @route   DELETE /api/feedback/:id
 * @access  Private/Admin
 */
const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    // Update complaint to remove feedback reference
    await Complaint.findByIdAndUpdate(feedback.complaint, {
      $unset: { feedback: 1 },
      "resolution.satisfaction": "pending",
    });

    await Feedback.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Delete feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting feedback",
    });
  }
};

module.exports = {
  submitFeedback,
  getFeedbackByComplaint,
  getMyFeedback,
  getAllFeedback,
  getFeedbackStats,
  getStaffFeedback,
  respondToFeedback,
  flagFeedback,
  updateReviewStatus,
  getPendingFeedbackRequests,
  checkFeedbackExists,
  getFeedbackTrends,
  deleteFeedback,
};
