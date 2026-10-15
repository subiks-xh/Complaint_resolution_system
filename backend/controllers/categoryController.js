/**
 * Category Controller
 *
 * Handles category management operations:
 * - CRUD operations for categories
 * - Category statistics
 * - SLA configuration
 * - Category suggestions
 */

const Category = require("../models/Category");
const Complaint = require("../models/Complaint");
const Organization = require("../models/Organization");
const mongoose = require("mongoose");

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
const getAllCategories = async (req, res) => {
  try {
    const {
      activeOnly = "true",
      includeStats = "false",
      parent,
      search,
      organization,
    } = req.query;

    const query = {};

    // 1. Resolve Organization Scope
    if (req.user) {
      if (req.user.role === "super_admin") {
        // Super admin sees all, or filters by specific org
        if (organization) {
          query.organization = organization;
        }
      } else {
        // Regular users/admins restricted to their organization
        query.organization = req.user.organization;
      }
    } else {
      // Public access - require organization
      // If we are in public mode, allow filtering by organization param
      if (organization) {
        query.organization = organization;
      } else {
        // If unauthenticated and no org specified, we can't return categories safely
        // But for compatibility, if we assume single-tenant or global categories...
        // For now, let's just not filter by org if not provided (RISKY, but avoids breaking if global)
        // Better: Return empty or error?
        // Let's assume the frontend might be sending orgId in query for public forms
        return res.status(400).json({
          success: false,
          message: "Organization context required",
        });
      }
    }

    if (activeOnly === "true") {
      query.isActive = true;
    }

    if (parent === "null" || parent === "root") {
      query.parent = null;
    } else if (parent) {
      query.parent = parent;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { keywords: { $regex: search, $options: "i" } },
      ];
    }

    let categories;

    if (includeStats === "true") {
      categories = await Category.aggregate([
        { $match: query },
        { $sort: { displayOrder: 1, name: 1 } },
        {
          $lookup: {
            from: "complaints",
            localField: "_id",
            foreignField: "category",
            as: "complaints",
          },
        },
        {
          $addFields: {
            complaintCount: { $size: "$complaints" },
            activeComplaints: {
              $size: {
                $filter: {
                  input: "$complaints",
                  as: "c",
                  // Use $not + $in because $nin is not an aggregation expression
                  cond: {
                    $not: { $in: ["$$c.status", ["resolved", "closed"]] },
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            complaints: 0,
          },
        },
      ]);
    } else {
      categories = await Category.find(query)
        .sort({ displayOrder: 1, name: 1 })
        .select("-statistics");
    }

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Get all categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get single category by ID or slug
 * @route   GET /api/categories/:identifier
 * @access  Public
 */
const getCategory = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { includeStats = "true" } = req.query;

    let category;

    // Check if identifier is ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      category = await Category.findOne({
        _id: identifier,
        organization: req.user?.organization,
      });
    } else {
      // Try to find by slug
      category = await Category.findOne({
        slug: identifier,
        organization: req.user?.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Update statistics if requested
    if (includeStats === "true") {
      await category.updateStatistics();
    }

    // Get children if any
    const children = await Category.find({
      parent: category._id,
      isActive: true,
    }).select("name slug icon color");

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        children,
        hasChildren: children.length > 0,
      },
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category",
    });
  }
};

/**
 * @desc    Create new category
 * @route   POST /api/categories
 * @access  Private/Admin
 */
const createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      color,
      parent,
      department,
      resolutionSLA,
      escalationConfig,
      defaultPriority,
      requiresAttachment,
      customFields,
      keywords,
      displayOrder,
    } = req.body;

    // Resolve organization context
    let targetOrg = req.user.organization;
    if (req.user.role === "super_admin") {
      targetOrg = req.body.organization || req.user.organization;
    }

    if (!targetOrg) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required to create a category",
      });
    }

    // Validate organization ID format
    if (!mongoose.Types.ObjectId.isValid(targetOrg)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    // Verify organization exists
    const orgExists = await Organization.findById(targetOrg);
    if (!orgExists) {
      return res.status(400).json({
        success: false,
        message: "Target organization not found",
      });
    }

    // Check for duplicate name in this organization
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      organization: targetOrg,
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message:
          "A category with this name already exists in your organization",
      });
    }

    // Validate parent if provided
    if (parent) {
      const parentCategory = await Category.findOne({
        _id: parent,
        organization: targetOrg,
      });
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found in this organization",
        });
      }
    }

    const category = await Category.create({
      name,
      organization: targetOrg,
      description,
      icon: icon || "folder",
      color: color || "#3B82F6",
      parent: parent || null,
      department,
      resolutionSLA: resolutionSLA || {
        low: 72,
        medium: 48,
        high: 24,
        critical: 4,
      },
      escalationConfig,
      defaultPriority: defaultPriority || "medium",
      requiresAttachment: requiresAttachment || false,
      customFields: customFields || [],
      keywords: keywords || [],
      displayOrder: displayOrder || 0,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A category with this name or slug already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private/Admin
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.statistics;
    delete updateData.organization; // Prevent org move

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const targetOrg = category.organization;

    // Check for duplicate name if name is being changed
    if (updateData.name && updateData.name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
        _id: { $ne: id },
        organization: targetOrg,
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message:
            "A category with this name already exists in your organization",
        });
      }
    }

    // Validate parent if being changed
    if (
      updateData.parent &&
      updateData.parent !== category.parent?.toString()
    ) {
      if (updateData.parent === id) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be its own parent",
        });
      }

      const parentCategory = await Category.findOne({
        _id: updateData.parent,
        organization: targetOrg,
      });
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found in this organization",
        });
      }

      // Check for circular reference
      const allChildren = await category.getAllChildren();
      if (
        allChildren.some((child) => child._id.toString() === updateData.parent)
      ) {
        return res.status(400).json({
          success: false,
          message: "Cannot set a child category as parent (circular reference)",
        });
      }
    }

    // Add updatedBy
    updateData.updatedBy = req.user.id;

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category",
    });
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private/Admin
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { reassignTo, forceDelete = "false" } = req.query;

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const targetOrg = category.organization;

    // Check for complaints using this category
    const complaintCount = await Complaint.countDocuments({
      category: id,
      organization: targetOrg, // Redundant if IDs are unique but good practice
    });

    if (complaintCount > 0) {
      if (forceDelete !== "true" && !reassignTo) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category with ${complaintCount} associated complaints. Provide reassignTo category or use forceDelete.`,
          complaintCount,
        });
      }

      if (reassignTo) {
        // Validate reassignment category
        const newCategory = await Category.findOne({
          _id: reassignTo,
          organization: targetOrg,
        });
        if (!newCategory) {
          return res.status(400).json({
            success: false,
            message: "Reassignment category not found",
          });
        }

        // Reassign complaints
        await Complaint.updateMany(
          { category: id, organization: targetOrg },
          { $set: { category: reassignTo } },
        );
      }
    }

    // Check for child categories
    const childCount = await Category.countDocuments({
      parent: id,
      organization: targetOrg,
    });
    if (childCount > 0) {
      // Update children to have no parent
      await Category.updateMany(
        { parent: id, organization: targetOrg },
        { $set: { parent: null } },
      );
    }

    await Category.findOneAndDelete({
      _id: id,
      organization: targetOrg,
    });

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: {
        complaintsReassigned: reassignTo ? complaintCount : 0,
        childrenOrphaned: childCount,
      },
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting category",
    });
  }
};

/**
 * @desc    Toggle category active status
 * @route   PUT /api/categories/:id/toggle-status
 * @access  Private/Admin
 */
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const targetOrg = category.organization;

    // If deactivating, check for active complaints
    if (category.isActive) {
      const activeComplaints = await Complaint.countDocuments({
        category: id,
        status: { $nin: ["resolved", "closed"] },
        organization: targetOrg,
      });

      if (activeComplaints > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate category with ${activeComplaints} active complaints`,
        });
      }
    }

    category.isActive = !category.isActive;
    category.updatedBy = req.user.id;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully`,
      data: category,
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category status",
    });
  }
};

/**
 * @desc    Get category tree structure
 * @route   GET /api/categories/tree
 * @access  Public
 */
const getCategoryTree = async (req, res) => {
  try {
    let orgScope;
    if (req.user) {
      if (req.user.role === "super_admin") {
        orgScope = req.query.organization || null;
      } else {
        orgScope = req.user.organization;
      }
    } else {
      orgScope = req.query.organization || null;
      if (!orgScope) {
        return res.status(400).json({
          success: false,
          message: "Organization context required",
        });
      }
    }

    const matchFilter = orgScope ? { organization: orgScope } : {};
    const tree = await Category.getTree(matchFilter);

    res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error("Get category tree error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category tree",
    });
  }
};

/**
 * @desc    Get category statistics
 * @route   GET /api/categories/:id/stats
 * @access  Private/Admin
 */
const getCategoryStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const targetOrg = category.organization;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      category: new mongoose.Types.ObjectId(id),
      organization: targetOrg, // Force org match
    };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    const [complaintStats, resolutionStats, priorityBreakdown, trendsData] =
      await Promise.all([
        // Complaint statistics by status
        Complaint.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Resolution time statistics
        Complaint.aggregate([
          {
            $match: {
              ...matchStage,
              "timeline.resolvedAt": { $exists: true },
            },
          },
          {
            $project: {
              resolutionTime: {
                $divide: [
                  {
                    $subtract: [
                      "$timeline.resolvedAt",
                      "$timeline.submittedAt",
                    ],
                  },
                  3600000, // hours
                ],
              },
              slaBreached: 1,
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTime: { $avg: "$resolutionTime" },
              minResolutionTime: { $min: "$resolutionTime" },
              maxResolutionTime: { $max: "$resolutionTime" },
              totalResolved: { $sum: 1 },
              slaBreached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
            },
          },
        ]),

        // Priority breakdown
        Complaint.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
            },
          },
        ]),

        // Trends (last 30 days)
        Complaint.aggregate([
          {
            $match: {
              category: new mongoose.Types.ObjectId(id),
              organization: targetOrg,
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
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    // Format statistics
    const statusCounts = complaintStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const priorityCounts = priorityBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const totalComplaints = Object.values(statusCounts).reduce(
      (a, b) => a + b,
      0,
    );
    const resolvedComplaints =
      (statusCounts["resolved"] || 0) + (statusCounts["closed"] || 0);

    res.status(200).json({
      success: true,
      data: {
        category: category.getSummary(),
        statistics: {
          total: totalComplaints,
          byStatus: statusCounts,
          byPriority: priorityCounts,
          resolutionRate:
            totalComplaints > 0
              ? Math.round((resolvedComplaints / totalComplaints) * 100)
              : 0,
          resolution: resolutionStats[0] || {
            avgResolutionTime: 0,
            minResolutionTime: 0,
            maxResolutionTime: 0,
            totalResolved: 0,
            slaBreached: 0,
          },
          slaComplianceRate: resolutionStats[0]
            ? Math.round(
                ((resolutionStats[0].totalResolved -
                  resolutionStats[0].slaBreached) /
                  resolutionStats[0].totalResolved) *
                  100,
              )
            : 100,
        },
        trends: trendsData,
      },
    });
  } catch (error) {
    console.error("Get category stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category statistics",
    });
  }
};

/**
 * @desc    Update category SLA
 * @route   PUT /api/categories/:id/sla
 * @access  Private/Admin
 */
const updateCategorySLA = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionSLA, escalationConfig } = req.body;

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (resolutionSLA) {
      // Validate SLA values
      const priorities = ["low", "medium", "high", "critical"];
      for (const priority of priorities) {
        if (resolutionSLA[priority] !== undefined) {
          if (resolutionSLA[priority] < 1 || resolutionSLA[priority] > 720) {
            return res.status(400).json({
              success: false,
              message: `SLA for ${priority} must be between 1 and 720 hours`,
            });
          }
        }
      }
      category.resolutionSLA = {
        ...category.resolutionSLA.toObject(),
        ...resolutionSLA,
      };
    }

    if (escalationConfig) {
      category.escalationConfig = {
        ...category.escalationConfig.toObject(),
        ...escalationConfig,
      };
    }

    category.updatedBy = req.user.id;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category SLA updated successfully",
      data: {
        resolutionSLA: category.resolutionSLA,
        escalationConfig: category.escalationConfig,
      },
    });
  } catch (error) {
    console.error("Update category SLA error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category SLA",
    });
  }
};

/**
 * @desc    Suggest category based on text
 * @route   POST /api/categories/suggest
 * @access  Public
 */
const suggestCategory = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least 10 characters for suggestion",
      });
    }

    const suggestedCategory = await Category.suggestCategory(text);

    if (!suggestedCategory) {
      // Return default/other category if no match found
      const defaultCategory = await Category.findOne({
        slug: "other",
        isActive: true,
      });

      return res.status(200).json({
        success: true,
        data: {
          suggested: defaultCategory || null,
          confidence: "low",
          message: "No strong match found, using default category",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        suggested: suggestedCategory.getSummary(),
        confidence: "high",
      },
    });
  } catch (error) {
    console.error("Suggest category error:", error);
    res.status(500).json({
      success: false,
      message: "Error suggesting category",
    });
  }
};

/**
 * @desc    Reorder categories
 * @route   PUT /api/categories/reorder
 * @access  Private/Admin
 */
const reorderCategories = async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        message: "Order must be an array of category IDs",
      });
    }

    const isSuperAdmin = req.user.role === "super_admin";
    if (!isSuperAdmin && !req.user.organization) {
      return res.status(403).json({
        success: false,
        message: "Organization context required",
      });
    }

    // Validate that order has valid ObjectIds and no duplicates
    for (const catId of order) {
      if (!mongoose.Types.ObjectId.isValid(catId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category ID: ${catId}`,
        });
      }
    }

    const orgFilter = isSuperAdmin ? {} : { organization: req.user.organization };

    // Strict contract: verify every ID in order exists within the authorized scope
    if (order.length > 0) {
      const matchingCount = await Category.countDocuments({
        _id: { $in: order },
        ...orgFilter,
      });

      if (matchingCount !== order.length) {
        return res.status(400).json({
          success: false,
          message: "One or more category IDs are invalid or belong to another organization",
        });
      }
    }

    const bulkOps = order.map((categoryId, index) => ({
      updateOne: {
        filter: { _id: categoryId, ...orgFilter },
        update: { $set: { displayOrder: index } },
      },
    }));

    if (bulkOps.length > 0) {
      await Category.bulkWrite(bulkOps);
    }

    const findFilter = { isActive: true, ...orgFilter };
    const categories = await Category.find(findFilter)
      .sort({ displayOrder: 1 })
      .select("name slug displayOrder");

    res.status(200).json({
      success: true,
      message: "Categories reordered successfully",
      data: categories,
    });
  } catch (error) {
    console.error("Reorder categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error reordering categories",
    });
  }
};

/**
 * @desc    Add keywords to category
 * @route   PUT /api/categories/:id/keywords
 * @access  Private/Admin
 */
const updateKeywords = async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords, action = "set" } = req.body;

    if (!Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        message: "Keywords must be an array",
      });
    }

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const normalizedKeywords = keywords.map((kw) => kw.toLowerCase().trim());

    if (action === "add") {
      const existingKeywords = new Set(category.keywords);
      normalizedKeywords.forEach((kw) => existingKeywords.add(kw));
      category.keywords = Array.from(existingKeywords);
    } else if (action === "remove") {
      category.keywords = category.keywords.filter(
        (kw) => !normalizedKeywords.includes(kw),
      );
    } else {
      category.keywords = normalizedKeywords;
    }

    category.updatedBy = req.user.id;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Keywords updated successfully",
      data: {
        keywords: category.keywords,
      },
    });
  } catch (error) {
    console.error("Update keywords error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating keywords",
    });
  }
};

/**
 * @desc    Seed default categories
 * @route   POST /api/categories/seed
 * @access  Private/Admin
 */
const seedCategories = async (req, res) => {
  try {
    await Category.seedDefaults();

    const categories = await Category.find().sort({ displayOrder: 1 });

    res.status(201).json({
      success: true,
      message: "Default categories seeded successfully",
      data: categories,
    });
  } catch (error) {
    console.error("Seed categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error seeding categories",
    });
  }
};

/**
 * @desc    Get all category statistics summary
 * @route   GET /api/categories/stats/all
 * @access  Private/Admin
 */
const getAllCategoryStats = async (req, res) => {
  try {
    let orgScope;
    if (req.user.role === "super_admin") {
      orgScope = req.query.organization || null;
    } else {
      orgScope = req.user.organization;
    }

    const matchFilter = orgScope ? { organization: orgScope } : {};
    const stats = await Category.getAllStatistics(matchFilter);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get all category stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category statistics",
    });
  }
};

/**
 * @desc    Assign staff to category
 * @route   PUT /api/categories/:id/staff
 * @access  Private/Admin
 */
const assignStaffToCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffIds, action = "set" } = req.body;

    if (!Array.isArray(staffIds)) {
      return res.status(400).json({
        success: false,
        message: "staffIds must be an array",
      });
    }

    let category;
    if (req.user.role === "super_admin") {
      category = await Category.findById(id);
    } else {
      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Organization context required",
        });
      }
      category = await Category.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Validate staff exist and belong to the category's organization
    const User = mongoose.model("User");
    const validStaff = await User.find({
      _id: { $in: staffIds },
      role: "staff",
      organization: category.organization,
      isActive: true,
    }).select("_id");

    if (validStaff.length !== staffIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more staff members are invalid or do not belong to this organization",
      });
    }

    const validStaffIds = validStaff.map((s) => s._id);

    if (action === "add") {
      const existingStaff = new Set(
        category.assignedStaff.map((s) => s.toString()),
      );
      validStaffIds.forEach((id) => existingStaff.add(id.toString()));
      category.assignedStaff = Array.from(existingStaff);
    } else if (action === "remove") {
      const removeIds = new Set(validStaffIds.map((id) => id.toString()));
      category.assignedStaff = category.assignedStaff.filter(
        (id) => !removeIds.has(id.toString()),
      );
    } else {
      category.assignedStaff = validStaffIds;
    }

    // Also update staff specializations
    for (const staffId of validStaffIds) {
      const staff = await User.findById(staffId);
      if (staff) {
        if (action === "remove") {
          staff.specializations = staff.specializations.filter(
            (s) => s.toString() !== id,
          );
        } else {
          const specs = new Set(staff.specializations.map((s) => s.toString()));
          specs.add(id);
          staff.specializations = Array.from(specs);
        }
        await staff.save();
      }
    }

    category.updatedBy = req.user.id;
    await category.save();

    await category.populate("assignedStaff", "name email department");

    res.status(200).json({
      success: true,
      message: "Staff assignments updated successfully",
      data: {
        assignedStaff: category.assignedStaff,
      },
    });
  } catch (error) {
    console.error("Assign staff to category error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating staff assignments",
    });
  }
};

module.exports = {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryTree,
  getCategoryStats,
  updateCategorySLA,
  suggestCategory,
  reorderCategories,
  updateKeywords,
  seedCategories,
  getAllCategoryStats,
  assignStaffToCategory,
};
