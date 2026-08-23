const mongoose = require("mongoose");

const assignmentRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Rule Conditions
    conditions: {
      categories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      priorities: [
        {
          type: String,
          enum: ["low", "medium", "high", "critical"],
        },
      ],
      workingHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String }, // "09:00"
        end: { type: String }, // "17:00"
        timezone: { type: String, default: "UTC" },
      },
      maxWorkload: {
        enabled: { type: Boolean, default: true },
        percentage: { type: Number, default: 80 },
      },
      skillMatching: {
        enabled: { type: Boolean, default: true },
        strictMode: { type: Boolean, default: false },
      },
      geographicProximity: {
        enabled: { type: Boolean, default: false },
        maxDistance: { type: Number, default: 50 }, // km
      },
    },

    // Assignment Actions
    actions: {
      assignmentMethod: {
        type: String,
        enum: [
          "round_robin",
          "least_loaded",
          "skill_based",
          "geographic",
          "performance_based",
          "ai_based",
        ],
        default: "least_loaded",
      },
      autoAssign: {
        type: Boolean,
        default: false,
      },
      notificationSettings: {
        assigneeNotification: { type: Boolean, default: true },
        userNotification: { type: Boolean, default: false },
        supervisorNotification: { type: Boolean, default: false },
        escalationNotification: { type: Boolean, default: true },
      },
      slaSettings: {
        useCustomSLA: { type: Boolean, default: false },
        customSLAHours: { type: Number },
        responseTimeHours: { type: Number },
        escalationEnabled: { type: Boolean, default: true },
      },
      scheduling: {
        allowScheduledAssignment: { type: Boolean, default: true },
        maxScheduleHours: { type: Number, default: 72 },
      },
    },

    // Rule Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0, // Higher numbers = higher priority
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },

    // Analytics
    usage: {
      totalAssignments: { type: Number, default: 0 },
      successfulAssignments: { type: Number, default: 0 },
      averageAssignmentTime: { type: Number, default: 0 }, // seconds
      lastUsed: { type: Date },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
assignmentRuleSchema.index({ organization: 1, isActive: 1, priority: -1 });
assignmentRuleSchema.index({ "conditions.categories": 1 });
assignmentRuleSchema.index({ "conditions.priorities": 1 });
assignmentRuleSchema.index({ isActive: 1, priority: -1 });

// Methods
assignmentRuleSchema.methods.updateUsage = function (assignmentTime) {
  this.usage.totalAssignments += 1;
  this.usage.successfulAssignments += 1;
  this.usage.averageAssignmentTime =
    (this.usage.averageAssignmentTime * (this.usage.totalAssignments - 1) +
      assignmentTime) /
    this.usage.totalAssignments;
  this.usage.lastUsed = new Date();
  return this.save();
};

assignmentRuleSchema.methods.checkApplicability = function (complaint) {
  // Check category match
  if (this.conditions.categories.length > 0) {
    const categoryMatch = this.conditions.categories.some(
      (cat) => cat.toString() === complaint.category.toString(),
    );
    if (!categoryMatch) return false;
  }

  // Check priority match
  if (this.conditions.priorities.length > 0) {
    if (!this.conditions.priorities.includes(complaint.priority)) return false;
  }

  // Check working hours if enabled
  if (this.conditions.workingHours.enabled) {
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(
      this.conditions.workingHours.start.split(":")[0],
    );
    const endHour = parseInt(this.conditions.workingHours.end.split(":")[0]);

    if (currentHour < startHour || currentHour >= endHour) return false;
  }

  return true;
};

// Static methods
assignmentRuleSchema.statics.findApplicableRules = async function (
  complaint,
  organization,
) {
  return await this.find({
    organization,
    isActive: true,
    $and: [
      {
        $or: [
          { "conditions.categories": { $in: [complaint.category] } },
          { "conditions.categories": { $size: 0 } },
        ],
      },
      {
        $or: [
          { "conditions.priorities": { $in: [complaint.priority] } },
          { "conditions.priorities": { $size: 0 } },
        ],
      },
    ],
  }).sort({ priority: -1 });
};

assignmentRuleSchema.statics.dropLegacyParallelArrayIndex = async function () {
  try {
    const indexes = await this.collection.indexes();
    const legacyIndex = indexes.find(
      (idx) =>
        idx.key &&
        idx.key["conditions.categories"] === 1 &&
        idx.key["conditions.priorities"] === 1,
    );

    if (legacyIndex) {
      await this.collection.dropIndex(legacyIndex.name);
      console.log(`Dropped legacy index: ${legacyIndex.name}`);
    }
  } catch (error) {
    if (error.codeName !== "IndexNotFound") {
      console.warn(
        "Could not drop legacy assignment rule index:",
        error.message,
      );
    }
  }
};

module.exports = mongoose.model("AssignmentRule", assignmentRuleSchema);
