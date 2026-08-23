/**
 * Escalation Rule Model
 *
 * Defines automatic escalation rules based on SLA conditions
 * and triggers for complaint resolution workflow.
 */

const mongoose = require("mongoose");

/**
 * Escalation Rule Schema
 */
const escalationRuleSchema = new mongoose.Schema(
  {
    // Rule identification
    name: {
      type: String,
      required: [true, "Rule name is required"],
      trim: true,
      maxlength: [100, "Rule name cannot exceed 100 characters"],
    },

    // Category filter (optional - if null, applies to all categories)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // Priority level this rule applies to
    priority: {
      type: String,
      required: [true, "Priority is required"],
      enum: {
        values: ["low", "medium", "high"],
        message: "Priority must be low, medium, or high",
      },
    },

    // Escalation conditions
    conditions: {
      // Time threshold in hours from complaint creation
      timeThreshold: {
        type: Number,
        required: true,
        min: [1, "Time threshold must be at least 1 hour"],
        max: [720, "Time threshold cannot exceed 720 hours (30 days)"],
        default: 24,
      },

      // Response threshold in hours (for new complaints)
      responseThreshold: {
        type: Number,
        required: true,
        min: [1, "Response threshold must be at least 1 hour"],
        max: [720, "Response threshold cannot exceed 720 hours (30 days)"],
        default: 72,
      },

      // No update threshold in hours
      noUpdateThreshold: {
        type: Number,
        required: true,
        min: [1, "No update threshold must be at least 1 hour"],
        max: [720, "No update threshold cannot exceed 720 hours (30 days)"],
        default: 48,
      },
    },

    // Actions to take when conditions are met
    actions: {
      // Escalate to supervisor/admin
      escalateToSupervisor: {
        type: Boolean,
        default: true,
      },

      // Increase priority level
      increasePriority: {
        type: Boolean,
        default: false,
      },

      // Send notification to relevant parties
      sendNotification: {
        type: Boolean,
        default: true,
      },

      // Auto-assign to available staff
      autoAssign: {
        type: Boolean,
        default: false,
      },
    },

    // Rule status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Organization (for multi-tenant support)
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: function() {
        return this.constructor.modelName === "EscalationRule";
      },
    },

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Execution statistics
    stats: {
      totalExecutions: {
        type: Number,
        default: 0,
      },
      lastExecuted: {
        type: Date,
        default: null,
      },
      totalEscalated: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for performance
escalationRuleSchema.index({ organization: 1, isActive: 1 });
escalationRuleSchema.index({ category: 1, priority: 1 });
escalationRuleSchema.index({ isActive: 1, "conditions.timeThreshold": 1 });

// Virtual for rule effectiveness
escalationRuleSchema.virtual("effectiveness").get(function() {
  if (this.stats.totalExecutions === 0) return 0;
  return ((this.stats.totalEscalated / this.stats.totalExecutions) * 100).toFixed(1);
});

// Method to check if rule conditions are met for a complaint
escalationRuleSchema.methods.checkConditions = function(complaint) {
  const now = new Date();
  const createdAt = new Date(complaint.createdAt);
  const lastUpdate = new Date(complaint.updatedAt || complaint.createdAt);
  
  // Calculate time differences in hours
  const hoursTotal = (now - createdAt) / (1000 * 60 * 60);
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

  const results = {
    shouldEscalate: false,
    reasons: [],
    timeData: {
      hoursTotal: Math.floor(hoursTotal * 10) / 10,
      hoursSinceUpdate: Math.floor(hoursSinceUpdate * 10) / 10,
    },
  };

  // Check time threshold
  if (hoursTotal >= this.conditions.timeThreshold) {
    results.shouldEscalate = true;
    results.reasons.push(`Time threshold exceeded (${Math.floor(hoursTotal)}h >= ${this.conditions.timeThreshold}h)`);
  }

  // Check no update threshold
  if (hoursSinceUpdate >= this.conditions.noUpdateThreshold) {
    results.shouldEscalate = true;
    results.reasons.push(`No update threshold exceeded (${Math.floor(hoursSinceUpdate)}h >= ${this.conditions.noUpdateThreshold}h)`);
  }

  // Check response threshold (for new complaints)
  if (complaint.status === "new" && hoursTotal >= this.conditions.responseThreshold) {
    results.shouldEscalate = true;
    results.reasons.push(`Response threshold exceeded (${Math.floor(hoursTotal)}h >= ${this.conditions.responseThreshold}h)`);
  }

  return results;
};

// Method to execute escalation actions
escalationRuleSchema.methods.executeActions = async function(complaint) {
  const updates = {
    status: "escalated",
    escalatedAt: new Date(),
    escalationRule: this._id,
  };

  // Increase priority if specified
  if (this.actions.increasePriority) {
    if (complaint.priority === "low") updates.priority = "medium";
    else if (complaint.priority === "medium") updates.priority = "high";
  }

  // Update statistics
  await this.constructor.findByIdAndUpdate(this._id, {
    $inc: { 
      "stats.totalExecutions": 1,
      "stats.totalEscalated": 1,
    },
    $set: {
      "stats.lastExecuted": new Date(),
    },
  });

  return updates;
};

// Static method to find applicable rules for a complaint
escalationRuleSchema.statics.findApplicableRules = async function(complaint) {
  const filter = {
    isActive: true,
    organization: complaint.organization,
    priority: complaint.priority,
  };

  // Category filter - either matching category or no category restriction
  filter.$or = [
    { category: complaint.category },
    { category: null },
  ];

  return this.find(filter).populate("category", "name").lean();
};

// Pre-save middleware
escalationRuleSchema.pre("save", function(next) {
  // Validate time thresholds make logical sense
  if (this.conditions.timeThreshold > this.conditions.responseThreshold) {
    const err = new Error("Time threshold should not exceed response threshold");
    return next(err);
  }

  next();
});

module.exports = mongoose.model("EscalationRule", escalationRuleSchema);