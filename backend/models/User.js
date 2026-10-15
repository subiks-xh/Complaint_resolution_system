/**
 * User Model
 *
 * Defines the schema for users in the complaint resolution system.
 * Supports three roles: user (complainants), staff (resolvers), and admin.
 * Includes authentication, profile management, and password reset functionality.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

/**
 * User Schema Definition
 */
const userSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false, // Don't include password in queries by default
    },

    // Role-based Access Control
    role: {
      type: String,
      enum: {
        values: ["super_admin", "org_admin", "staff", "user"],
        message: "Role must be super_admin, org_admin, staff, or user",
      },
      default: "user",
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      default: null,
      index: true,
    },

    isOnboarded: {
      type: Boolean,
      default: true,
    },

    onboardingCompletedAt: {
      type: Date,
      default: null,
    },

    onboardingProfile: {
      organizationType: {
        type: String,
        enum: ["college", "company", "institute", "other"],
        default: null,
      },
      userIdentifier: {
        type: String,
        trim: true,
        maxlength: [120, "User identifier cannot exceed 120 characters"],
      },
      preferredPaymentMode: {
        type: String,
        enum: ["online", "offline", "either"],
        default: "either",
      },
      preferredPaymentTimeSlot: {
        type: String,
        enum: ["morning", "afternoon", "evening", "night", "anytime"],
        default: "anytime",
      },
    },

    // Organization Reference (Multi-tenancy)
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: function () {
        // Super Admins operate globally and have no organization.
        if (this.role === "super_admin") {
          return false;
        }

        // Un-onboarded Google users can exist temporarily without organization.
        if (this.role === "user" && this.isOnboarded === false) {
          return false;
        }

        // Staff members can be initially registered or imported without an assigned organization.
        if (this.role === "staff") {
          return false;
        }

        return true;
      },
    },

    // Contact Information
    phone: {
      type: String,
      trim: true,
      match: [
        /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
        "Please provide a valid phone number",
      ],
    },

    // Organization Details (primarily for staff/admin)
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department name cannot exceed 100 characters"],
    },

    designation: {
      type: String,
      trim: true,
      maxlength: [100, "Designation cannot exceed 100 characters"],
    },

    // Profile Picture
    avatar: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Staff-specific fields
    specializations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    maxAssignedComplaints: {
      type: Number,
      default: 10,
      min: [1, "Must be able to handle at least 1 complaint"],
      max: [50, "Cannot handle more than 50 complaints at once"],
    },

    // Performance & Assignment Tracking
    performanceMetrics: {
      totalAssignments: { type: Number, default: 0 },
      completedAssignments: { type: Number, default: 0 },
      averageResolutionTime: { type: Number, default: 0 }, // in hours
      averageRating: { type: Number, default: 0 }, // 1-5 scale
      slaComplianceRate: { type: Number, default: 100 }, // percentage
      lastAssignmentDate: Date,
      responseTimeMetrics: {
        averageFirstResponse: { type: Number, default: 0 }, // in minutes
        averageOverallResponse: { type: Number, default: 0 }, // in minutes
        fastestResponse: { type: Number, default: 0 },
        slowestResponse: { type: Number, default: 0 },
      },
      workloadDistribution: {
        low: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        high: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
      },
      monthlyStats: [
        {
          month: { type: String }, // YYYY-MM format
          assignmentsReceived: { type: Number, default: 0 },
          assignmentsCompleted: { type: Number, default: 0 },
          averageRating: { type: Number, default: 0 },
          slaCompliance: { type: Number, default: 100 },
        },
      ],
    },

    // Assignment Preferences
    assignmentPreferences: {
      preferredCategories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      workingHours: {
        start: { type: String, default: "09:00" }, // HH:MM format
        end: { type: String, default: "17:00" },
        timezone: { type: String, default: "UTC" },
        workingDays: [{ type: Number, default: [1, 2, 3, 4, 5] }], // 0=Sunday, 1=Monday, etc.
      },
      maxConcurrentAssignments: { type: Number, default: 5 },
      autoAcceptAssignments: { type: Boolean, default: false },
      notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
    },

    // Staff Status Tracking
    staffStatus: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now },
      currentWorkload: { type: Number, default: 0 },
      availabilityStatus: {
        type: String,
        enum: ["available", "busy", "away", "offline"],
        default: "offline",
      },
      statusMessage: String,
      lastStatusUpdate: { type: Date, default: Date.now },
    },

    // Authentication Tokens
    refreshToken: {
      type: String,
      select: false,
    },

    // Password Reset
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    // Email Verification
    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpire: {
      type: Date,
      select: false,
    },

    // Security
    passwordChangedAt: {
      type: Date,
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
    },

    lastLogin: {
      type: Date,
    },

    // Notification Preferences
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },
      inApp: {
        type: Boolean,
        default: true,
      },
      complaintUpdates: {
        type: Boolean,
        default: true,
      },
      escalationAlerts: {
        type: Boolean,
        default: true,
      },
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
// userSchema.index({ email: 1 }); // Removed duplicate
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, department: 1 });

/**
 * Virtual Fields
 */

// Get user's full profile URL
userSchema.virtual("profileUrl").get(function () {
  return `/users/${this._id}`;
});

// Get complaints submitted by this user (for regular users)
userSchema.virtual("submittedComplaints", {
  ref: "Complaint",
  localField: "_id",
  foreignField: "user",
  count: true,
});

// Get complaints assigned to this user (for staff)
userSchema.virtual("assignedComplaints", {
  ref: "Complaint",
  localField: "_id",
  foreignField: "assignedTo",
  count: true,
});

// Check if account is locked
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

/**
 * Pre-save Middleware
 */

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash if password is modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    // Update passwordChangedAt if not new document
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token is created after
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Update passwordChangedAt when password is modified
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) {
    return next();
  }
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

/**
 * Instance Methods
 */

// Compare password for authentication
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after token was issued
userSchema.methods.passwordChangedAfter = function (tokenIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return tokenIssuedAt < changedTimestamp;
  }
  return false;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token and store in database
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expiry (1 hour)
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

  // Return unhashed token (to send via email)
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expiry (24 hours)
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // Lock for 2 hours
  }

  return this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: Date.now() },
    $unset: { lockUntil: 1 },
  });
};

// Get public profile (safe to send to client)
userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    department: this.department,
    designation: this.designation,
    organization: this.organization,
    avatar: this.avatar?.url || null,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    authProvider: this.authProvider,
    isOnboarded: this.isOnboarded,
    onboardingCompletedAt: this.onboardingCompletedAt,
    onboardingProfile: this.onboardingProfile,
    notificationPreferences: this.notificationPreferences || {
      email: true,
      inApp: true,
      complaintUpdates: true,
      escalationAlerts: true,
    },
    createdAt: this.createdAt,
  };
};

// Get staff profile with workload info
userSchema.methods.toStaffProfile = function () {
  return {
    ...this.toPublicProfile(),
    specializations: this.specializations,
    maxAssignedComplaints: this.maxAssignedComplaints,
  };
};

/**
 * Static Methods
 */

// Find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Find active users by role
userSchema.statics.findByRole = function (role, activeOnly = true) {
  const query = { role };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query);
};

// Find available staff for assignment
userSchema.statics.findAvailableStaff = async function (
  organizationId,
  categoryId = null,
) {
  try {
    console.log(
      "Finding available staff for organization:",
      organizationId,
      "category:",
      categoryId,
    );

    const baseQuery = {
      role: "staff",
      isActive: true,
      organization: new mongoose.Types.ObjectId(organizationId),
    };

    // Simple approach first - get all active staff
    let staff = await this.find(baseQuery).select(
      "-password -refreshToken -resetPasswordToken",
    );

    console.log("Found", staff.length, "active staff members");

    if (staff.length === 0) {
      return [];
    }

    // For each staff member, count active complaints
    const staffWithWorkload = await Promise.all(
      staff.map(async (member) => {
        try {
          const Complaint = mongoose.model("Complaint");
          const activeCount = await Complaint.countDocuments({
            assignedTo: member._id,
            status: { $in: ["assigned", "in_progress", "new"] },
          });

          const maxAssigned = member.maxAssignedComplaints || 10;
          const availableCapacity = maxAssigned - activeCount;

          // Add computed fields
          return {
            ...member.toObject(),
            activeComplaintCount: activeCount,
            availableCapacity: availableCapacity,
            maxAssignedComplaints: maxAssigned,
          };
        } catch (error) {
          console.error(
            "Error calculating workload for staff:",
            member.email,
            error,
          );
          return {
            ...member.toObject(),
            activeComplaintCount: 0,
            availableCapacity: 10,
            maxAssignedComplaints: 10,
          };
        }
      }),
    );

    // Filter only those with available capacity
    let availableStaff = staffWithWorkload.filter(
      (member) => member.availableCapacity > 0,
    );

    console.log("Staff with capacity:", availableStaff.length);

    // If category is specified, prefer specialized staff but also include general staff
    if (categoryId) {
      const specializedStaff = availableStaff.filter(
        (member) =>
          member.specializations && member.specializations.includes(categoryId),
      );

      const generalStaff = availableStaff.filter(
        (member) =>
          !member.specializations ||
          !member.specializations.includes(categoryId),
      );

      // Return specialized staff first, then general staff
      availableStaff = [...specializedStaff, ...generalStaff];
    }

    // Sort by available capacity (highest first)
    availableStaff.sort((a, b) => b.availableCapacity - a.availableCapacity);

    console.log("Final available staff count:", availableStaff.length);
    return availableStaff;
  } catch (error) {
    console.error("Error in findAvailableStaff:", error);
    return [];
  }
};

// Get staff statistics
userSchema.statics.getStaffStats = async function (staffId) {
  const Complaint = mongoose.model("Complaint");
  const Feedback = mongoose.model("Feedback");

  const [complaintStats, feedbackStats] = await Promise.all([
    Complaint.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(staffId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
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
          "complaintInfo.assignedTo": new mongoose.Types.ObjectId(staffId),
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalFeedbacks: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    complaints: complaintStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    feedback: feedbackStats[0] || { averageRating: 0, totalFeedbacks: 0 },
  };
};

// Verify reset password token
userSchema.statics.findByResetToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
};

// Verify email verification token
userSchema.statics.findByVerificationToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() },
  });
};

/**
 * Performance Tracking Methods
 */

// Update performance metrics after complaint resolution
userSchema.methods.updatePerformanceMetrics = async function (assignmentLog) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Update overall metrics
  this.performanceMetrics.totalAssignments += 1;
  if (assignmentLog.status === "completed") {
    this.performanceMetrics.completedAssignments += 1;

    if (assignmentLog.metrics.responseTime) {
      // Update average resolution time
      const totalTime =
        this.performanceMetrics.averageResolutionTime *
        (this.performanceMetrics.completedAssignments - 1);
      this.performanceMetrics.averageResolutionTime =
        (totalTime + assignmentLog.metrics.responseTime) /
        this.performanceMetrics.completedAssignments;
    }
  }

  // Update SLA compliance
  if (assignmentLog.metrics.isWithinSLA !== undefined) {
    const currentCompliance = this.performanceMetrics.slaComplianceRate;
    const newRate =
      (currentCompliance * (this.performanceMetrics.totalAssignments - 1) +
        (assignmentLog.metrics.isWithinSLA ? 100 : 0)) /
      this.performanceMetrics.totalAssignments;
    this.performanceMetrics.slaComplianceRate = newRate;
  }

  // Update monthly stats
  let monthlyStatIndex = this.performanceMetrics.monthlyStats.findIndex(
    (stat) => stat.month === monthKey,
  );
  if (monthlyStatIndex === -1) {
    this.performanceMetrics.monthlyStats.push({
      month: monthKey,
      assignmentsReceived: 1,
      assignmentsCompleted: assignmentLog.status === "completed" ? 1 : 0,
      averageRating: 0,
      slaCompliance: assignmentLog.metrics.isWithinSLA ? 100 : 0,
    });
  } else {
    const monthlyStats = this.performanceMetrics.monthlyStats[monthlyStatIndex];
    monthlyStats.assignmentsReceived += 1;
    if (assignmentLog.status === "completed") {
      monthlyStats.assignmentsCompleted += 1;
    }
    // Update SLA compliance for the month
    monthlyStats.slaCompliance =
      (monthlyStats.slaCompliance * (monthlyStats.assignmentsReceived - 1) +
        (assignmentLog.metrics.isWithinSLA ? 100 : 0)) /
      monthlyStats.assignmentsReceived;
  }

  this.performanceMetrics.lastAssignmentDate = now;
  return this.save();
};

// Update staff status
userSchema.methods.updateStaffStatus = function (status, message = "") {
  this.staffStatus.availabilityStatus = status;
  this.staffStatus.statusMessage = message;
  this.staffStatus.lastStatusUpdate = new Date();
  if (status === "available") {
    this.staffStatus.isOnline = true;
  } else if (status === "offline") {
    this.staffStatus.isOnline = false;
  }
  return this.save();
};

// Check if staff is available for assignment
userSchema.methods.isAvailableForAssignment = function () {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Check if staff is active and online
  if (!this.isActive || !this.staffStatus.isOnline) {
    return false;
  }

  // Check availability status
  if (
    this.staffStatus.availabilityStatus === "offline" ||
    this.staffStatus.availabilityStatus === "away"
  ) {
    return false;
  }

  // Check working hours
  const workingHours = this.assignmentPreferences.workingHours;
  const startHour = parseInt(workingHours.start.split(":")[0]);
  const endHour = parseInt(workingHours.end.split(":")[0]);

  if (currentHour < startHour || currentHour >= endHour) {
    return false;
  }

  // Check working days
  if (!workingHours.workingDays.includes(currentDay)) {
    return false;
  }

  // Check current workload
  if (
    this.staffStatus.currentWorkload >=
    this.assignmentPreferences.maxConcurrentAssignments
  ) {
    return false;
  }

  return true;
};

// Get staff performance summary
userSchema.methods.getPerformanceSummary = function () {
  const metrics = this.performanceMetrics;
  const completionRate =
    metrics.totalAssignments > 0
      ? (metrics.completedAssignments / metrics.totalAssignments) * 100
      : 0;

  return {
    totalAssignments: metrics.totalAssignments,
    completionRate: Math.round(completionRate),
    slaComplianceRate: Math.round(metrics.slaComplianceRate),
    averageResolutionTime: Math.round(metrics.averageResolutionTime),
    averageRating: Number(metrics.averageRating.toFixed(1)),
    lastAssignmentDate: metrics.lastAssignmentDate,
    currentWorkload: this.staffStatus.currentWorkload,
    availabilityStatus: this.staffStatus.availabilityStatus,
    isOnline: this.staffStatus.isOnline,
  };
};

/**
 * Static Methods for Assignment Analytics
 */

// Get top performing staff
userSchema.statics.getTopPerformers = async function (
  organizationId,
  limit = 10,
) {
  return this.find({
    organization: organizationId,
    role: "staff",
    "performanceMetrics.totalAssignments": { $gt: 0 },
  })
    .sort({
      "performanceMetrics.slaComplianceRate": -1,
      "performanceMetrics.averageRating": -1,
      "performanceMetrics.averageResolutionTime": 1,
    })
    .limit(limit)
    .select("name email performanceMetrics staffStatus");
};

// Get workload distribution
userSchema.statics.getWorkloadDistribution = async function (organizationId) {
  const pipeline = [
    {
      $match: {
        organization: new mongoose.Types.ObjectId(organizationId),
        role: "staff",
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$staffStatus.availabilityStatus",
        count: { $sum: 1 },
        averageWorkload: { $avg: "$staffStatus.currentWorkload" },
        totalCapacity: { $sum: "$maxAssignedComplaints" },
        usedCapacity: { $sum: "$staffStatus.currentWorkload" },
      },
    },
  ];

  return this.aggregate(pipeline);
};

/**
 * Query Helpers
 */

// Only active users
userSchema.query.active = function () {
  return this.where({ isActive: true });
};

// Only staff members
userSchema.query.staff = function () {
  return this.where({ role: "staff" });
};

// Only admins
userSchema.query.admins = function () {
  return this.where({ role: "admin" });
};

// Available staff for assignment
userSchema.query.availableForAssignment = function () {
  const now = new Date();
  return this.where({
    isActive: true,
    role: "staff",
    "staffStatus.isOnline": true,
    "staffStatus.availabilityStatus": { $in: ["available", "busy"] },
    $expr: {
      $lt: [
        "$staffStatus.currentWorkload",
        "$assignmentPreferences.maxConcurrentAssignments",
      ],
    },
  });
};

// Create and export the model
const User = mongoose.model("User", userSchema);

module.exports = User;
