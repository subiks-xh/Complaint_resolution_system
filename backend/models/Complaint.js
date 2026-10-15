/**
 * Complaint Model
 *
 * Defines the schema for complaints in the resolution system.
 * Includes full lifecycle tracking, escalation history,
 * status updates, file attachments, and SLA management.
 */

const mongoose = require("mongoose");

/**
 * Attachment Sub-schema
 */
const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: null,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

/**
 * Status History Sub-schema
 */
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: [
        "new",
        "assigned",
        "in-progress",
        "resolved",
        "closed",
        "escalated",
        "reopened",
      ],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.changedByRole !== "system";
      },
      default: null,
    },
    changedByRole: {
      type: String,
      enum: ["user", "staff", "admin", "system"],
      default: "system",
    },
    remarks: {
      type: String,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

/**
 * Escalation History Sub-schema
 */
const escalationHistorySchema = new mongoose.Schema(
  {
    escalatedAt: {
      type: Date,
      default: Date.now,
    },
    escalationLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    reason: {
      type: String,
      required: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    escalationType: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },
    previousAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reassignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: true },
);

/**
 * Main Complaint Schema
 */
const complaintSchema = new mongoose.Schema(
  {
    // Unique Complaint ID (auto-generated)
    complaintId: {
      type: String,
      unique: true,
      // index: true, // Removed duplicate
    },

    // Complaint Details
    title: {
      type: String,
      required: [true, "Complaint title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters long"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      required: [true, "Complaint description is required"],
      minlength: [20, "Description must be at least 20 characters long"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },

    // Organization Reference (Multi-tenancy)
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Category Reference
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    // Priority Level
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high", "critical"],
        message: "Priority must be low, medium, high, or critical",
      },
      default: "medium",
    },

    // Current Status
    status: {
      type: String,
      enum: {
        values: [
          "new",
          "assigned",
          "in-progress",
          "resolved",
          "closed",
          "escalated",
          "reopened",
        ],
        message: "Invalid status value",
      },
      default: "new",
    },

    // User who submitted the complaint
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // Staff assigned to handle the complaint
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Admin who assigned the complaint
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // File Attachments
    attachments: [attachmentSchema],

    // Timeline Tracking
    timeline: {
      submittedAt: {
        type: Date,
        default: Date.now,
      },
      assignedAt: {
        type: Date,
      },
      firstResponseAt: {
        type: Date,
      },
      resolvedAt: {
        type: Date,
      },
      closedAt: {
        type: Date,
      },
      escalatedAt: {
        type: Date,
      },
      reopenedAt: {
        type: Date,
      },
      lastUpdatedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // SLA Management
    resolutionDeadline: {
      type: Date,
    },

    slaBreached: {
      type: Boolean,
      default: false,
    },

    // Resolution Details
    resolution: {
      remarks: {
        type: String,
        maxlength: [2000, "Resolution remarks cannot exceed 2000 characters"],
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      evidence: [attachmentSchema],
      satisfaction: {
        type: String,
        enum: ["pending", "satisfied", "unsatisfied"],
        default: "pending",
      },
    },

    // Escalation Tracking
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    escalationHistory: [escalationHistorySchema],

    // Status Change History
    statusHistory: [statusHistorySchema],

    // Additional Information
    location: {
      building: String,
      floor: String,
      room: String,
      address: String,
    },

    // Tags for filtering
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Internal Notes (visible only to staff/admin)
    internalNotes: [
      {
        note: {
          type: String,
          maxlength: [1000, "Note cannot exceed 1000 characters"],
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Staff work timer tracking (shared across staff/admin/user views)
    workTracking: {
      totalSeconds: {
        type: Number,
        default: 0,
        min: 0,
      },
      activeSessionStartedAt: {
        type: Date,
        default: null,
      },
      lastPausedAt: {
        type: Date,
        default: null,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      logs: [
        {
          action: {
            type: String,
            enum: ["start", "pause"],
            required: true,
          },
          at: {
            type: Date,
            default: Date.now,
          },
          by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          totalSecondsAfterAction: {
            type: Number,
            default: 0,
          },
        },
      ],
    },

    // Payment workflow state (requested by staff after work completion)
    paymentWorkflow: {
      isPaymentRequested: {
        type: Boolean,
        default: false,
      },
      paymentStatus: {
        type: String,
        enum: ["none", "requested", "paid", "acknowledged"],
        default: "none",
      },
      requestedAmount: {
        type: Number,
        default: null,
      },
      requestedMethod: {
        type: String,
        enum: ["online", "offline", "either", "manual"],
        default: "either",
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      acknowledgedAt: {
        type: Date,
        default: null,
      },
      acknowledgedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      paymentRecord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
    },

    // System warning tracking for scheduler deduplication
    warningTracking: {
      lastSentAt: {
        type: Date,
      },
      sentCount: {
        type: Number,
        default: 0,
      },
    },

    // Feedback Reference
    feedback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
    },

    // Visibility
    isArchived: {
      type: Boolean,
      default: false,
    },

    // Reopening tracking
    reopenCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Indexes for Performance
 */
// complaintSchema.index({ complaintId: 1 }); // Removed duplicate
complaintSchema.index({ user: 1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ resolutionDeadline: 1 });
complaintSchema.index({ slaBreached: 1 });
complaintSchema.index({ "timeline.submittedAt": -1 });
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
complaintSchema.index({ user: 1, status: 1 });
complaintSchema.index({ status: 1, resolutionDeadline: 1 });
complaintSchema.index({ organization: 1, status: 1, createdAt: -1 });
complaintSchema.index({ organization: 1, assignedTo: 1, status: 1 });
complaintSchema.index({ organization: 1, category: 1, status: 1 });
complaintSchema.index({ organization: 1, priority: 1, status: 1 });

// Text index for search
complaintSchema.index({
  title: "text",
  description: "text",
  "resolution.remarks": "text",
});

/**
 * Virtual Fields
 */

// Check if complaint is overdue
complaintSchema.virtual("isOverdue").get(function () {
  if (!this.resolutionDeadline) return false;
  if (["resolved", "closed"].includes(this.status)) return false;
  return new Date() > this.resolutionDeadline;
});

// Calculate age in hours
complaintSchema.virtual("ageInHours").get(function () {
  const now = new Date();
  const created = this.timeline?.submittedAt || this.createdAt;
  return Math.floor((now - created) / (1000 * 60 * 60));
});

// Calculate age in days
complaintSchema.virtual("ageInDays").get(function () {
  return Math.floor(this.ageInHours / 24);
});

// Time remaining until deadline
complaintSchema.virtual("timeRemaining").get(function () {
  if (!this.resolutionDeadline) return null;
  const remaining = this.resolutionDeadline - new Date();
  return remaining > 0 ? remaining : 0;
});

// Resolution time (if resolved)
complaintSchema.virtual("resolutionTime").get(function () {
  if (!this.timeline?.resolvedAt) return null;
  const submitted = this.timeline?.submittedAt || this.createdAt;
  return this.timeline.resolvedAt - submitted;
});

/**
 * Pre-save Middleware
 */

// Generate unique complaint ID before saving
complaintSchema.pre("save", async function (next) {
  // Only generate ID for new complaints
  if (this.isNew && !this.complaintId) {
    const year = new Date().getFullYear();

    // Find the last complaint of the current year
    const lastComplaint = await this.constructor
      .findOne({ complaintId: new RegExp(`^CMP-${year}-`) })
      .sort({ complaintId: -1 });

    let sequence = 1;
    if (lastComplaint && lastComplaint.complaintId) {
      const lastSequence = parseInt(
        lastComplaint.complaintId.split("-")[2],
        10,
      );
      sequence = lastSequence + 1;
    }

    this.complaintId = `CMP-${year}-${String(sequence).padStart(5, "0")}`;
  }

  // Update lastUpdatedAt only if not explicitly set or modified
  if (!this.timeline.lastUpdatedAt || !this.isNew) {
    this.timeline.lastUpdatedAt = new Date();
  }

  next();
});

// Add status to history when status changes
complaintSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    // Update relevant timeline fields
    const now = new Date();

    switch (this.status) {
      case "assigned":
        if (!this.timeline.assignedAt) {
          this.timeline.assignedAt = now;
        }
        break;
      case "in-progress":
        if (!this.timeline.firstResponseAt) {
          this.timeline.firstResponseAt = now;
        }
        break;
      case "resolved":
        this.timeline.resolvedAt = now;
        break;
      case "closed":
        this.timeline.closedAt = now;
        break;
      case "escalated":
        this.timeline.escalatedAt = now;
        break;
      case "reopened":
        this.timeline.reopenedAt = now;
        this.reopenCount += 1;
        break;
    }
  }

  next();
});

// Check SLA breach
complaintSchema.pre("save", function (next) {
  if (this.resolutionDeadline && !this.slaBreached) {
    if (
      new Date() > this.resolutionDeadline &&
      !["resolved", "closed"].includes(this.status)
    ) {
      this.slaBreached = true;
    }
  }
  next();
});

/**
 * Instance Methods
 */

// Add status change to history
complaintSchema.methods.addStatusHistory = function (
  status,
  userId,
  role,
  remarks = "",
) {
  this.statusHistory.push({
    status,
    changedBy: userId,
    changedByRole: role,
    remarks,
    changedAt: new Date(),
  });
  this.status = status;
  return this;
};

// Add escalation record
complaintSchema.methods.addEscalation = function (options) {
  const {
    reason,
    escalatedBy,
    escalationType = "manual",
    reassignedTo,
  } = options;

  this.escalationLevel += 1;

  this.escalationHistory.push({
    escalatedAt: new Date(),
    escalationLevel: this.escalationLevel,
    reason,
    escalatedBy,
    escalationType,
    previousAssignee: this.assignedTo,
    reassignedTo,
  });

  if (reassignedTo) {
    this.assignedTo = reassignedTo;
  }

  this.status = "escalated";
  this.timeline.escalatedAt = new Date();

  return this;
};

// Add internal note
complaintSchema.methods.addInternalNote = function (note, userId) {
  this.internalNotes.push({
    note,
    addedBy: userId,
    addedAt: new Date(),
  });
  return this;
};

// Add attachment
complaintSchema.methods.addAttachment = function (attachmentData) {
  this.attachments.push({
    ...attachmentData,
    uploadedAt: new Date(),
  });
  return this;
};

// Set resolution
complaintSchema.methods.setResolution = function (
  remarks,
  resolvedBy,
  evidence = [],
) {
  this.resolution = {
    remarks,
    resolvedBy,
    evidence,
    satisfaction: "pending",
  };
  this.status = "resolved";
  this.timeline.resolvedAt = new Date();
  return this;
};

// Calculate and set deadline based on category SLA
complaintSchema.methods.setDeadlineFromSLA = async function () {
  await this.populate("category");

  if (this.category && this.category.resolutionSLA) {
    const slaHours =
      this.category.resolutionSLA[this.priority] ||
      this.category.resolutionSLA.medium ||
      48; // Default 48 hours

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + slaHours);
    this.resolutionDeadline = deadline;
  }

  return this;
};

// Get complaint summary
complaintSchema.methods.getSummary = function () {
  return {
    id: this._id,
    complaintId: this.complaintId,
    title: this.title,
    status: this.status,
    priority: this.priority,
    category: this.category,
    isOverdue: this.isOverdue,
    ageInDays: this.ageInDays,
    createdAt: this.createdAt,
  };
};

/**
 * Static Methods
 */

// Get complaints by status
complaintSchema.statics.findByStatus = function (status, options = {}) {
  const query = this.find({ status });

  if (options.populate) {
    query.populate(options.populate);
  }

  if (options.sort) {
    query.sort(options.sort);
  }

  return query;
};

// Get complaints for a user
complaintSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({ user: userId });

  if (options.status) {
    query.where({ status: options.status });
  }

  return query.sort({ createdAt: -1 });
};

// Get complaints assigned to staff
complaintSchema.statics.findByAssignee = function (staffId, options = {}) {
  const query = this.find({ assignedTo: staffId });

  if (options.status) {
    if (Array.isArray(options.status)) {
      query.where({ status: { $in: options.status } });
    } else {
      query.where({ status: options.status });
    }
  }

  return query.sort({ priority: -1, createdAt: -1 });
};

// Get overdue complaints
complaintSchema.statics.findOverdue = function () {
  return this.find({
    resolutionDeadline: { $lt: new Date() },
    status: { $nin: ["resolved", "closed"] },
  }).sort({ resolutionDeadline: 1 });
};

// Get complaints due for escalation
complaintSchema.statics.findDueForEscalation = function () {
  return this.find({
    status: { $nin: ["resolved", "closed", "escalated"] },
    resolutionDeadline: { $lt: new Date() },
    slaBreached: true,
  });
};

// Get complaint statistics
complaintSchema.statics.getStatistics = async function (filter = {}) {
  const matchStage = {};

  if (filter.startDate || filter.endDate) {
    matchStage.createdAt = {};
    if (filter.startDate) {
      matchStage.createdAt.$gte = new Date(filter.startDate);
    }
    if (filter.endDate) {
      matchStage.createdAt.$lte = new Date(filter.endDate);
    }
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
        total: [{ $count: "count" }],
        avgResolutionTime: [
          {
            $match: {
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
        ],
        slaBreached: [{ $match: { slaBreached: true } }, { $count: "count" }],
      },
    },
  ]);

  return {
    byStatus: stats[0].byStatus,
    byPriority: stats[0].byPriority,
    byCategory: stats[0].byCategory,
    total: stats[0].total[0]?.count || 0,
    avgResolutionTimeMs: stats[0].avgResolutionTime[0]?.avgTime || null,
    slaBreachedCount: stats[0].slaBreached[0]?.count || 0,
  };
};

// Search complaints
complaintSchema.statics.search = function (searchTerm, options = {}) {
  const query = this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: "textScore" } },
  );

  if (options.status) {
    query.where({ status: options.status });
  }

  if (options.category) {
    query.where({ category: options.category });
  }

  if (options.priority) {
    query.where({ priority: options.priority });
  }

  return query
    .sort({ score: { $meta: "textScore" } })
    .limit(options.limit || 50);
};

/**
 * Query Helpers
 */

// Filter by date range
complaintSchema.query.dateRange = function (startDate, endDate) {
  if (startDate) {
    this.where({ createdAt: { $gte: new Date(startDate) } });
  }
  if (endDate) {
    this.where({ createdAt: { $lte: new Date(endDate) } });
  }
  return this;
};

// Filter active (not archived)
complaintSchema.query.active = function () {
  return this.where({ isArchived: false });
};

// Filter by priority
complaintSchema.query.highPriority = function () {
  return this.where({ priority: { $in: ["high", "critical"] } });
};

// Create and export the model
const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;
