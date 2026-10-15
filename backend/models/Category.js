/**
 * Category Model
 *
 * Defines complaint categories with SLA configuration.
 * Used for organizing complaints and determining resolution deadlines.
 */

const mongoose = require("mongoose");

/**
 * SLA Configuration Sub-schema
 * Defines resolution time limits in hours for each priority level
 */
const slaConfigSchema = new mongoose.Schema(
  {
    low: {
      type: Number,
      default: 72, // 72 hours (3 days)
      min: [1, "SLA must be at least 1 hour"],
      max: [720, "SLA cannot exceed 720 hours (30 days)"],
    },
    medium: {
      type: Number,
      default: 48, // 48 hours (2 days)
      min: [1, "SLA must be at least 1 hour"],
      max: [720, "SLA cannot exceed 720 hours (30 days)"],
    },
    high: {
      type: Number,
      default: 24, // 24 hours (1 day)
      min: [1, "SLA must be at least 1 hour"],
      max: [720, "SLA cannot exceed 720 hours (30 days)"],
    },
    critical: {
      type: Number,
      default: 4, // 4 hours
      min: [1, "SLA must be at least 1 hour"],
      max: [720, "SLA cannot exceed 720 hours (30 days)"],
    },
  },
  { _id: false },
);

/**
 * Escalation Configuration Sub-schema
 */
const escalationConfigSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    // Percentage of SLA after which to send warning
    warningThreshold: {
      type: Number,
      default: 75, // 75% of SLA time
      min: 50,
      max: 95,
    },
    // Auto-escalate after SLA breach
    autoEscalate: {
      type: Boolean,
      default: true,
    },
    // Maximum escalation levels
    maxLevels: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
  },
  { _id: false },
);

/**
 * Main Category Schema
 */
const categorySchema = new mongoose.Schema(
  {
    // Category name
    name: {
      type: String,
      required: [true, "Category name is required"],
      // unique: true, // Removed global uniqueness, will use compound index with organization
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },

    // Organization Reference (Multi-tenancy)
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    // URL-friendly slug
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Description
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Icon (for UI display)
    icon: {
      type: String,
      default: "folder", // Default icon name
      trim: true,
    },

    // Color code for UI
    color: {
      type: String,
      default: "#3B82F6", // Default blue color
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"],
    },

    // Category status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Parent category (for hierarchical structure)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // Display order
    displayOrder: {
      type: Number,
      default: 0,
    },

    // SLA Configuration
    resolutionSLA: {
      type: slaConfigSchema,
      default: () => ({}),
    },

    // Escalation Configuration
    escalationConfig: {
      type: escalationConfigSchema,
      default: () => ({}),
    },

    // Department responsible for this category
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department name cannot exceed 100 characters"],
    },

    // Staff specializing in this category
    assignedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Default priority for complaints in this category
    defaultPriority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Whether attachments are required
    requiresAttachment: {
      type: Boolean,
      default: false,
    },

    // Custom fields for this category
    customFields: [
      {
        fieldName: {
          type: String,
          required: true,
          trim: true,
        },
        fieldType: {
          type: String,
          enum: ["text", "number", "date", "select", "checkbox"],
          default: "text",
        },
        isRequired: {
          type: Boolean,
          default: false,
        },
        options: [String], // For select type
        placeholder: String,
      },
    ],

    // Keywords for auto-categorization
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // Statistics (denormalized for performance)
    statistics: {
      totalComplaints: {
        type: Number,
        default: 0,
      },
      resolvedComplaints: {
        type: Number,
        default: 0,
      },
      avgResolutionTime: {
        type: Number, // In hours
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
categorySchema.index({ organization: 1, name: 1 }, { unique: true }); // Name unique per org
categorySchema.index({ organization: 1, slug: 1 }, { unique: true }); // Slug unique per org
categorySchema.index({ isActive: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ department: 1 });
categorySchema.index({ keywords: 1 });

/**
 * Virtual Fields
 */

// Get children categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Get complaint count
categorySchema.virtual("complaints", {
  ref: "Complaint",
  localField: "_id",
  foreignField: "category",
  count: true,
});

// Check if has sub-categories
categorySchema.virtual("hasChildren").get(function () {
  return false; // Will be populated when needed
});

// Resolution rate
categorySchema.virtual("resolutionRate").get(function () {
  if (!this.statistics || this.statistics.totalComplaints === 0) {
    return 0;
  }
  return Math.round(
    (this.statistics.resolvedComplaints / this.statistics.totalComplaints) *
      100,
  );
});

/**
 * Pre-save Middleware
 */

// Generate slug from name
categorySchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Validate parent category
categorySchema.pre("save", async function (next) {
  if (this.parent) {
    // Prevent circular reference
    if (this.parent.toString() === this._id.toString()) {
      return next(new Error("Category cannot be its own parent"));
    }

    // Check if parent exists
    const parentExists = await this.constructor.findById(this.parent);
    if (!parentExists) {
      return next(new Error("Parent category does not exist"));
    }
  }
  next();
});

/**
 * Instance Methods
 */

// Get SLA for a specific priority
categorySchema.methods.getSLA = function (priority) {
  const validPriorities = ["low", "medium", "high", "critical"];
  const normalizedPriority = validPriorities.includes(priority)
    ? priority
    : "medium";
  return this.resolutionSLA[normalizedPriority] || this.resolutionSLA.medium;
};

// Calculate deadline from now based on priority
categorySchema.methods.calculateDeadline = function (priority) {
  const slaHours = this.getSLA(priority);
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + slaHours);
  return deadline;
};

// Get full path (for hierarchical categories)
categorySchema.methods.getPath = async function () {
  const path = [this];
  let current = this;

  while (current.parent) {
    current = await this.constructor.findById(current.parent);
    if (current) {
      path.unshift(current);
    } else {
      break;
    }
  }

  return path.map((cat) => ({
    id: cat._id,
    name: cat.name,
    slug: cat.slug,
  }));
};

// Get all children (recursive)
categorySchema.methods.getAllChildren = async function () {
  const children = await this.constructor.find({ parent: this._id });

  let allChildren = [...children];

  for (const child of children) {
    const grandChildren = await child.getAllChildren();
    allChildren = [...allChildren, ...grandChildren];
  }

  return allChildren;
};

// Update statistics
categorySchema.methods.updateStatistics = async function () {
  const Complaint = mongoose.model("Complaint");

  const stats = await Complaint.aggregate([
    { $match: { category: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
          },
        },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $and: ["$timeline.resolvedAt", "$timeline.submittedAt"] },
              {
                $divide: [
                  {
                    $subtract: [
                      "$timeline.resolvedAt",
                      "$timeline.submittedAt",
                    ],
                  },
                  3600000, // Convert to hours
                ],
              },
              null,
            ],
          },
        },
      },
    },
  ]);

  if (stats.length > 0) {
    this.statistics = {
      totalComplaints: stats[0].total || 0,
      resolvedComplaints: stats[0].resolved || 0,
      avgResolutionTime: Math.round(stats[0].avgResolutionTime || 0),
      lastUpdated: new Date(),
    };
    await this.save();
  }

  return this.statistics;
};

// Get category summary
categorySchema.methods.getSummary = function () {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    icon: this.icon,
    color: this.color,
    description: this.description,
    isActive: this.isActive,
    complaintCount: this.statistics?.totalComplaints || 0,
  };
};

/**
 * Static Methods
 */

// Find active categories
categorySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

// Find root categories (no parent)
categorySchema.statics.findRootCategories = function () {
  return this.find({ parent: null, isActive: true }).sort({ displayOrder: 1 });
};

// Find by slug
categorySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase() });
};

// Get category tree
categorySchema.statics.getTree = async function (match = {}) {
  // Merge isActive: true with provided match, or just use provided match if it overrides
  const query = { isActive: true, ...match };

  const categories = await this.find(query)
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  // Build tree structure
  const categoryMap = {};
  const tree = [];

  // First pass: create map
  categories.forEach((cat) => {
    categoryMap[cat._id.toString()] = { ...cat, children: [] };
  });

  // Second pass: build tree
  categories.forEach((cat) => {
    if (cat.parent) {
      const parentId = cat.parent.toString();
      if (categoryMap[parentId]) {
        categoryMap[parentId].children.push(categoryMap[cat._id.toString()]);
      }
    } else {
      tree.push(categoryMap[cat._id.toString()]);
    }
  });

  return tree;
};

// Find categories by department
categorySchema.statics.findByDepartment = function (department) {
  return this.find({
    department: department,
    isActive: true,
  }).sort({ displayOrder: 1 });
};

// Auto-categorize based on text
categorySchema.statics.suggestCategory = async function (text) {
  if (!text) return null;

  const words = text.toLowerCase().split(/\s+/);

  const categories = await this.find({
    isActive: true,
    keywords: { $in: words },
  });

  if (categories.length === 0) {
    return null;
  }

  // Count keyword matches for each category
  const scored = categories.map((cat) => {
    const matchCount = cat.keywords.filter((kw) => words.includes(kw)).length;
    return { category: cat, score: matchCount };
  });

  // Return category with highest score
  scored.sort((a, b) => b.score - a.score);
  return scored[0].category;
};

// Get category statistics summary
categorySchema.statics.getAllStatistics = async function (match = {}) {
  const query = { isActive: true, ...match };
  const categories = await this.find(query);

  return Promise.all(
    categories.map(async (cat) => ({
      category: cat.getSummary(),
      statistics: cat.statistics,
    })),
  );
};

// Seed default categories
categorySchema.statics.seedDefaults = async function () {
  const defaultCategories = [
    {
      name: "IT Support",
      description: "Technical issues with hardware, software, or network",
      icon: "computer",
      color: "#3B82F6",
      department: "IT Department",
      keywords: [
        "computer",
        "laptop",
        "network",
        "internet",
        "software",
        "hardware",
        "email",
        "printer",
      ],
      resolutionSLA: { low: 72, medium: 48, high: 24, critical: 4 },
      displayOrder: 1,
    },
    {
      name: "Maintenance",
      description: "Building and facility maintenance requests",
      icon: "wrench",
      color: "#F59E0B",
      department: "Facilities",
      keywords: [
        "repair",
        "fix",
        "broken",
        "maintenance",
        "plumbing",
        "electrical",
        "ac",
        "hvac",
      ],
      resolutionSLA: { low: 120, medium: 72, high: 24, critical: 8 },
      displayOrder: 2,
    },
    {
      name: "Human Resources",
      description: "HR-related queries and issues",
      icon: "users",
      color: "#10B981",
      department: "HR",
      keywords: [
        "hr",
        "leave",
        "salary",
        "payroll",
        "benefits",
        "harassment",
        "policy",
      ],
      resolutionSLA: { low: 120, medium: 72, high: 48, critical: 24 },
      displayOrder: 3,
    },
    {
      name: "Security",
      description: "Security concerns and incidents",
      icon: "shield",
      color: "#EF4444",
      department: "Security",
      keywords: [
        "security",
        "theft",
        "access",
        "badge",
        "cctv",
        "safety",
        "emergency",
      ],
      resolutionSLA: { low: 48, medium: 24, high: 8, critical: 2 },
      displayOrder: 4,
    },
    {
      name: "Housekeeping",
      description: "Cleaning and sanitation services",
      icon: "sparkles",
      color: "#8B5CF6",
      department: "Facilities",
      keywords: [
        "cleaning",
        "trash",
        "garbage",
        "sanitation",
        "washroom",
        "toilet",
      ],
      resolutionSLA: { low: 48, medium: 24, high: 8, critical: 4 },
      displayOrder: 5,
    },
    {
      name: "Administration",
      description: "General administrative requests",
      icon: "clipboard",
      color: "#6366F1",
      department: "Admin",
      keywords: [
        "certificate",
        "document",
        "letter",
        "approval",
        "permission",
        "form",
      ],
      resolutionSLA: { low: 120, medium: 72, high: 48, critical: 24 },
      displayOrder: 6,
    },
    {
      name: "Other",
      description: "General complaints that don't fit other categories",
      icon: "folder",
      color: "#6B7280",
      department: "General",
      keywords: [],
      resolutionSLA: { low: 120, medium: 72, high: 48, critical: 24 },
      displayOrder: 99,
    },
  ];

  for (const catData of defaultCategories) {
    const exists = await this.findOne({ name: catData.name });
    if (!exists) {
      await this.create(catData);
      console.log(`Created category: ${catData.name}`);
    }
  }

  console.log("Default categories seeded successfully");
};

// Create and export the model
const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
