/**
 * Feedback Model
 *
 * Captures user satisfaction feedback after complaint resolution.
 * Used for quality assessment and staff performance evaluation.
 */

const mongoose = require("mongoose");

/**
 * Rating Breakdown Sub-schema
 * Allows for detailed rating across different aspects
 */
const ratingBreakdownSchema = new mongoose.Schema(
  {
    responseTime: {
      type: Number,
      min: 1,
      max: 5,
    },
    resolution: {
      type: Number,
      min: 1,
      max: 5,
    },
    communication: {
      type: Number,
      min: 1,
      max: 5,
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  { _id: false },
);

/**
 * Main Feedback Schema
 */
const feedbackSchema = new mongoose.Schema(
  {
    // Reference to the resolved complaint
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: [true, "Complaint reference is required"],
      unique: true, // One feedback per complaint
    },

    // User who submitted the feedback
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // Staff who resolved the complaint
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Overall rating (1-5 stars)
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },

    // Detailed rating breakdown (optional)
    ratingBreakdown: ratingBreakdownSchema,

    // Satisfaction level
    satisfactionLevel: {
      type: String,
      enum: {
        values: [
          "very_dissatisfied",
          "dissatisfied",
          "neutral",
          "satisfied",
          "very_satisfied",
        ],
        message: "Invalid satisfaction level",
      },
    },

    // Written comments
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, "Comments cannot exceed 2000 characters"],
    },

    // Would recommend the service
    wouldRecommend: {
      type: Boolean,
      default: null,
    },

    // Specific aspects they liked
    positiveAspects: [
      {
        type: String,
        enum: [
          "quick_response",
          "professional_handling",
          "effective_solution",
          "good_communication",
          "helpful_staff",
          "thorough_investigation",
          "kept_informed",
          "exceeded_expectations",
        ],
      },
    ],

    // Areas for improvement
    improvementAreas: [
      {
        type: String,
        enum: [
          "response_time",
          "communication",
          "solution_quality",
          "follow_up",
          "staff_attitude",
          "process_clarity",
          "resolution_time",
          "information_updates",
        ],
      },
    ],

    // Issue fully resolved flag
    issueResolved: {
      type: Boolean,
      default: true,
    },

    // Additional follow-up required
    needsFollowUp: {
      type: Boolean,
      default: false,
    },

    followUpReason: {
      type: String,
      maxlength: [500, "Follow-up reason cannot exceed 500 characters"],
    },

    // Admin response to feedback
    adminResponse: {
      response: {
        type: String,
        maxlength: [1000, "Response cannot exceed 1000 characters"],
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      respondedAt: {
        type: Date,
      },
    },

    // Visibility flags
    isPublic: {
      type: Boolean,
      default: false,
    },

    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Review status (for moderation)
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "pending",
    },

    // Flagged for review
    isFlagged: {
      type: Boolean,
      default: false,
    },

    flagReason: {
      type: String,
      maxlength: [500, "Flag reason cannot exceed 500 characters"],
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
// feedbackSchema.index({ complaint: 1 }, { unique: true }); // Removed duplicate
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ resolvedBy: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ reviewStatus: 1 });
feedbackSchema.index({ resolvedBy: 1, rating: 1 });

/**
 * Virtual Fields
 */

// Rating label
feedbackSchema.virtual("ratingLabel").get(function () {
  const labels = {
    1: "Very Poor",
    2: "Poor",
    3: "Average",
    4: "Good",
    5: "Excellent",
  };
  return labels[this.rating] || "Unknown";
});

// Calculate average breakdown rating
feedbackSchema.virtual("averageBreakdownRating").get(function () {
  if (!this.ratingBreakdown) return null;

  const ratings = Object.values(this.ratingBreakdown.toObject()).filter(
    (val) => typeof val === "number",
  );

  if (ratings.length === 0) return null;

  return ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
});

/**
 * Pre-save Middleware
 */

// Set satisfaction level based on rating if not provided
feedbackSchema.pre("save", function (next) {
  if (this.isModified("rating") && !this.satisfactionLevel) {
    const satisfactionMap = {
      1: "very_dissatisfied",
      2: "dissatisfied",
      3: "neutral",
      4: "satisfied",
      5: "very_satisfied",
    };
    this.satisfactionLevel = satisfactionMap[this.rating];
  }
  next();
});

// Update complaint's resolution satisfaction
feedbackSchema.post("save", async function () {
  try {
    const Complaint = mongoose.model("Complaint");
    const satisfaction = this.rating >= 4 ? "satisfied" : "unsatisfied";

    await Complaint.findByIdAndUpdate(this.complaint, {
      "resolution.satisfaction": satisfaction,
      feedback: this._id,
    });
  } catch (error) {
    console.error("Error updating complaint satisfaction:", error);
  }
});

/**
 * Instance Methods
 */

// Add admin response
feedbackSchema.methods.addAdminResponse = function (response, adminId) {
  this.adminResponse = {
    response,
    respondedBy: adminId,
    respondedAt: new Date(),
  };
  return this;
};

// Flag feedback for review
feedbackSchema.methods.flag = function (reason) {
  this.isFlagged = true;
  this.flagReason = reason;
  this.reviewStatus = "flagged";
  return this;
};

// Approve feedback
feedbackSchema.methods.approve = function () {
  this.reviewStatus = "approved";
  this.isFlagged = false;
  return this;
};

// Get sanitized public version
feedbackSchema.methods.toPublic = function () {
  const feedback = this.toObject();

  if (this.isAnonymous) {
    delete feedback.user;
  }

  return {
    id: feedback._id,
    rating: feedback.rating,
    ratingLabel: this.ratingLabel,
    comments: feedback.comments,
    satisfactionLevel: feedback.satisfactionLevel,
    positiveAspects: feedback.positiveAspects,
    createdAt: feedback.createdAt,
    user: this.isAnonymous ? null : feedback.user,
  };
};

/**
 * Static Methods
 */

// Get feedback for a complaint
feedbackSchema.statics.findByComplaint = function (complaintId) {
  return this.findOne({ complaint: complaintId })
    .populate("user", "name email")
    .populate("resolvedBy", "name email");
};

// Get feedback by user
feedbackSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({ user: userId });

  if (options.limit) {
    query.limit(options.limit);
  }

  return query
    .sort({ createdAt: -1 })
    .populate("complaint", "complaintId title");
};

// Get staff feedback statistics
feedbackSchema.statics.getStaffStats = async function (staffId) {
  const stats = await this.aggregate([
    { $match: { resolvedBy: new mongoose.Types.ObjectId(staffId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalFeedbacks: { $sum: 1 },
        ratingDistribution: {
          $push: "$rating",
        },
        recommendCount: {
          $sum: { $cond: ["$wouldRecommend", 1, 0] },
        },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalFeedbacks: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationRate: 0,
    };
  }

  const result = stats[0];

  // Calculate rating distribution
  const distribution = result.ratingDistribution.reduce(
    (acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  );

  return {
    averageRating: Math.round(result.averageRating * 10) / 10,
    totalFeedbacks: result.totalFeedbacks,
    ratingDistribution: distribution,
    recommendationRate:
      result.totalFeedbacks > 0
        ? Math.round((result.recommendCount / result.totalFeedbacks) * 100)
        : 0,
  };
};

// Get overall system statistics
feedbackSchema.statics.getOverallStats = async function (dateFilter = {}) {
  const matchStage = {};

  if (dateFilter.startDate) {
    matchStage.createdAt = { $gte: new Date(dateFilter.startDate) };
  }
  if (dateFilter.endDate) {
    matchStage.createdAt = matchStage.createdAt || {};
    matchStage.createdAt.$lte = new Date(dateFilter.endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalFeedbacks: { $sum: 1 },
        satisfiedCount: {
          $sum: {
            $cond: [
              { $in: ["$satisfactionLevel", ["satisfied", "very_satisfied"]] },
              1,
              0,
            ],
          },
        },
        issueResolvedCount: {
          $sum: { $cond: ["$issueResolved", 1, 0] },
        },
        needsFollowUpCount: {
          $sum: { $cond: ["$needsFollowUp", 1, 0] },
        },
      },
    },
    {
      $project: {
        averageRating: { $round: ["$averageRating", 2] },
        totalFeedbacks: 1,
        satisfactionRate: {
          $round: [
            {
              $multiply: [
                { $divide: ["$satisfiedCount", "$totalFeedbacks"] },
                100,
              ],
            },
            1,
          ],
        },
        resolutionRate: {
          $round: [
            {
              $multiply: [
                { $divide: ["$issueResolvedCount", "$totalFeedbacks"] },
                100,
              ],
            },
            1,
          ],
        },
        followUpRate: {
          $round: [
            {
              $multiply: [
                { $divide: ["$needsFollowUpCount", "$totalFeedbacks"] },
                100,
              ],
            },
            1,
          ],
        },
      },
    },
  ]);

  return (
    stats[0] || {
      averageRating: 0,
      totalFeedbacks: 0,
      satisfactionRate: 0,
      resolutionRate: 0,
      followUpRate: 0,
    }
  );
};

// Get feedback trends over time
feedbackSchema.statics.getTrends = async function (
  period = "month",
  limit = 12,
) {
  const groupFormat = {
    day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    week: { $dateToString: { format: "%Y-W%V", date: "$createdAt" } },
    month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
  };

  return this.aggregate([
    {
      $group: {
        _id: groupFormat[period] || groupFormat.month,
        averageRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: limit },
    { $sort: { _id: 1 } },
  ]);
};

// Get improvement areas analysis
feedbackSchema.statics.getImprovementAnalysis = async function () {
  return this.aggregate([
    { $unwind: "$improvementAreas" },
    {
      $group: {
        _id: "$improvementAreas",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// Get positive aspects analysis
feedbackSchema.statics.getPositiveAnalysis = async function () {
  return this.aggregate([
    { $unwind: "$positiveAspects" },
    {
      $group: {
        _id: "$positiveAspects",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// Create and export the model
const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
