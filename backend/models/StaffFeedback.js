/**
 * Staff Feedback Model
 * 
 * Handles general staff feedback from both admin and users
 * Separate from complaint-specific feedback for broader evaluation
 */

const mongoose = require("mongoose");

const staffFeedbackSchema = new mongoose.Schema(
  {
    // Staff member being evaluated
    staffMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff member reference is required"],
    },

    // User who gave the feedback
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Feedback giver reference is required"],
    },

    // Type of feedback (admin or user)
    feedbackType: {
      type: String,
      enum: ["admin", "user"],
      required: [true, "Feedback type is required"],
    },

    // Overall rating (1-5 stars)
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },

    // Feedback category
    category: {
      type: String,
      enum: [
        "general",
        "communication", 
        "technical",
        "timeliness",
        "problem_solving",
        "attitude",
        "teamwork",
        "leadership",
        "customer_service"
      ],
      default: "general",
    },

    // Written comments
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },

    // Anonymous feedback flag
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Reference to complaint if feedback is complaint-related
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },

    // Feedback visibility
    isPublic: {
      type: Boolean,
      default: false,
    },

    // Review status
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // Auto-approve admin feedback
    },

    // Additional metadata
    metadata: {
      userAgent: String,
      ipAddress: String,
      submissionSource: {
        type: String,
        enum: ["admin_panel", "user_portal", "mobile_app"],
        default: "admin_panel",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for better query performance
 */
staffFeedbackSchema.index({ staffMember: 1 });
staffFeedbackSchema.index({ givenBy: 1 });
staffFeedbackSchema.index({ feedbackType: 1 });
staffFeedbackSchema.index({ rating: 1 });
staffFeedbackSchema.index({ category: 1 });
staffFeedbackSchema.index({ createdAt: -1 });
staffFeedbackSchema.index({ staffMember: 1, rating: 1 });
staffFeedbackSchema.index({ staffMember: 1, createdAt: -1 });

/**
 * Virtual Fields
 */
staffFeedbackSchema.virtual("ratingLabel").get(function () {
  const labels = {
    1: "Poor",
    2: "Fair", 
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };
  return labels[this.rating] || "Unknown";
});

/**
 * Pre-save middleware
 */
staffFeedbackSchema.pre("save", function (next) {
  // Auto-approve admin feedback
  if (this.isNew && this.feedbackType === "admin") {
    this.reviewStatus = "approved";
  }
  next();
});

/**
 * Static Methods
 */

// Get staff feedback with statistics
staffFeedbackSchema.statics.getStaffFeedbackWithStats = async function (staffId) {
  const feedback = await this.find({ staffMember: staffId })
    .populate("givenBy", "name email role")
    .populate("relatedComplaint", "complaintId title")
    .sort({ createdAt: -1 });

  const stats = await this.aggregate([
    { $match: { staffMember: new mongoose.Types.ObjectId(staffId) } },
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
        feedbackTypeBreakdown: {
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

  if (stats.length > 0) {
    const result = stats[0];
    
    // Calculate rating distribution
    const distribution = result.ratingDistribution.reduce(
      (acc, rating) => {
        acc[rating] = (acc[rating] || 0) + 1;
        return acc;
      },
      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    );

    // Calculate category stats
    const categoryStats = result.categoryBreakdown.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { total: 0, sum: 0, average: 0 };
      }
      acc[item.category].total++;
      acc[item.category].sum += item.rating;
      acc[item.category].average = acc[item.category].sum / acc[item.category].total;
      return acc;
    }, {});

    // Calculate type stats
    const typeStats = result.feedbackTypeBreakdown.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = { total: 0, sum: 0, average: 0 };
      }
      acc[item.type].total++;
      acc[item.type].sum += item.rating;
      acc[item.type].average = acc[item.type].sum / acc[item.type].total;
      return acc;
    }, {});

    statistics = {
      averageRating: Math.round(result.averageRating * 10) / 10,
      totalCount: result.totalCount,
      distribution,
      categoryStats,
      typeStats,
    };
  }

  return {
    feedback,
    statistics,
  };
};

// Get feedback statistics for dashboard
staffFeedbackSchema.statics.getDashboardStats = async function (staffId, dateFilter = {}) {
  const matchStage = { staffMember: new mongoose.Types.ObjectId(staffId) };
  
  if (dateFilter.startDate || dateFilter.endDate) {
    matchStage.createdAt = {};
    if (dateFilter.startDate) {
      matchStage.createdAt.$gte = new Date(dateFilter.startDate);
    }
    if (dateFilter.endDate) {
      matchStage.createdAt.$lte = new Date(dateFilter.endDate);
    }
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalCount: { $sum: 1 },
        adminFeedbackCount: {
          $sum: { $cond: [{ $eq: ["$feedbackType", "admin"] }, 1, 0] },
        },
        userFeedbackCount: {
          $sum: { $cond: [{ $eq: ["$feedbackType", "user"] }, 1, 0] },
        },
        recentFeedback: {
          $push: {
            rating: "$rating",
            comment: "$comment",
            category: "$category",
            feedbackType: "$feedbackType",
            createdAt: "$createdAt",
          },
        },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalCount: 0,
      adminFeedbackCount: 0,
      userFeedbackCount: 0,
      recentFeedback: [],
    };
  }

  const result = stats[0];
  
  // Sort recent feedback by date and limit to 5
  result.recentFeedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  result.recentFeedback = result.recentFeedback.slice(0, 5);

  return {
    averageRating: Math.round(result.averageRating * 10) / 10,
    totalCount: result.totalCount,
    adminFeedbackCount: result.adminFeedbackCount,
    userFeedbackCount: result.userFeedbackCount,
    recentFeedback: result.recentFeedback,
  };
};

// Get staff ranking based on feedback
staffFeedbackSchema.statics.getStaffRanking = async function (limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: "$staffMember",
        averageRating: { $avg: "$rating" },
        totalFeedback: { $sum: 1 },
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
    {
      $unwind: "$staffInfo",
    },
    {
      $match: {
        totalFeedback: { $gte: 3 }, // Minimum 3 feedback entries
      },
    },
    {
      $sort: { averageRating: -1, totalFeedback: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        staffMember: "$_id",
        name: "$staffInfo.name",
        email: "$staffInfo.email",
        department: "$staffInfo.department",
        averageRating: { $round: ["$averageRating", 1] },
        totalFeedback: 1,
      },
    },
  ]);
};

// Instance methods
staffFeedbackSchema.methods.toSafeObject = function () {
  const feedback = this.toObject();
  
  if (this.isAnonymous) {
    delete feedback.givenBy;
  }
  
  return feedback;
};

// Create and export the model
const StaffFeedback = mongoose.model("StaffFeedback", staffFeedbackSchema);

module.exports = StaffFeedback;