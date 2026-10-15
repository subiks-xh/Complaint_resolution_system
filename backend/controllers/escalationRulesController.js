/**
 * Escalation Rules Controller
 *
 * Handles escalation rule operations:
 * - Creating, updating, deleting escalation rules
 * - Managing SLA conditions and triggers
 * - Automatic escalation processing
 */

const EscalationRule = require("../models/EscalationRule");
const Category = require("../models/Category");
const Complaint = require("../models/Complaint");
const { sendEscalationNotification, sendSLABreachNotification } = require("./notificationController");

/**
 * @desc    Get all escalation rules
 * @route   GET /api/admin/escalation-rules
 * @access  Private/Admin
 */
const getEscalationRules = async (req, res) => {
  try {
    // Build filter based on user role and organization
    const filter = {};
    
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    const rules = await EscalationRule.find(filter)
      .populate("category", "name description")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: rules,
    });
  } catch (err) {
    console.error("Get escalation rules error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve escalation rules",
      error: err.message,
    });
  }
};

/**
 * @desc    Create new escalation rule
 * @route   POST /api/admin/escalation-rules
 * @access  Private/Admin
 */
const createEscalationRule = async (req, res) => {
  try {
    const {
      name,
      category,
      priority,
      conditions,
      actions,
      isActive = true,
    } = req.body;

    // Validate required fields
    if (!name || !priority || !conditions || !actions) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let orgId = req.user.organization;
    if (req.user.role === "super_admin") {
      if (req.body.organization) {
        orgId = req.body.organization;
      }
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Organization is required to create an escalation rule",
      });
    }

    // Check if category exists and belongs to the same organization
    if (category) {
      const categoryExists = await Category.findOne({
        _id: category,
        organization: orgId,
      });
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found in target organization",
        });
      }
    }

    const rule = await EscalationRule.create({
      name,
      category: category || null,
      priority,
      conditions: {
        timeThreshold: conditions.timeThreshold || 24,
        responseThreshold: conditions.responseThreshold || 72,
        noUpdateThreshold: conditions.noUpdateThreshold || 48,
      },
      actions: {
        escalateToSupervisor: actions.escalateToSupervisor || false,
        increasePriority: actions.increasePriority || false,
        sendNotification: actions.sendNotification || true,
        autoAssign: actions.autoAssign || false,
      },
      isActive,
      organization: orgId,
      createdBy: req.user._id || req.user.id,
    });

    await rule.populate("category", "name description");

    res.status(201).json({
      success: true,
      data: rule,
      message: "Escalation rule created successfully",
    });
  } catch (err) {
    console.error("Create escalation rule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create escalation rule",
      error: err.message,
    });
  }
};

/**
 * @desc    Update escalation rule
 * @route   PUT /api/admin/escalation-rules/:id
 * @access  Private/Admin
 */
const updateEscalationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build filter based on user role and organization
    const filter = { _id: id };
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    const rule = await EscalationRule.findOneAndUpdate(
      filter,
      { 
        ...updates,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate("category", "name description");

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Escalation rule not found",
      });
    }

    res.json({
      success: true,
      data: rule,
      message: "Escalation rule updated successfully",
    });
  } catch (err) {
    console.error("Update escalation rule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update escalation rule",
      error: err.message,
    });
  }
};

/**
 * @desc    Delete escalation rule
 * @route   DELETE /api/admin/escalation-rules/:id
 * @access  Private/Admin
 */
const deleteEscalationRule = async (req, res) => {
  try {
    const { id } = req.params;

    // Build filter based on user role and organization
    const filter = { _id: id };
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    const rule = await EscalationRule.findOneAndDelete(filter);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Escalation rule not found",
      });
    }

    res.json({
      success: true,
      message: "Escalation rule deleted successfully",
    });
  } catch (err) {
    console.error("Delete escalation rule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete escalation rule",
      error: err.message,
    });
  }
};

/**
 * @desc    Toggle escalation rule status
 * @route   PATCH /api/admin/escalation-rules/:id/toggle
 * @access  Private/Admin
 */
const toggleEscalationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Build filter based on user role and organization
    const filter = { _id: id };
    if (req.user.role !== "super_admin") {
      filter.organization = req.user.organization;
    }

    const rule = await EscalationRule.findOneAndUpdate(
      filter,
      { 
        isActive,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate("category", "name description");

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Escalation rule not found",
      });
    }

    res.json({
      success: true,
      data: rule,
      message: `Rule ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (err) {
    console.error("Toggle escalation rule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to toggle rule status",
      error: err.message,
    });
  }
};

const { runEscalationCycle } = require("../utils/escalationEngine");

/**
 * @desc    Check and process escalations for all complaints
 * @route   POST /api/admin/escalation-rules/process
 * @access  Private/Admin (for manual processing)
 */
const processEscalations = async (req, res) => {
  try {
    const orgId = req.user.role === "super_admin" ? null : req.user.organization;
    const results = await runEscalationCycle({ organizationId: orgId });

    res.json({
      success: true,
      data: results,
      message: "Escalation processing completed",
    });
  } catch (err) {
    console.error("Process escalations error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to process escalations",
      error: err.message,
    });
  }
};

/**
 * Internal function to check and escalate complaints
 * Delegated to unified escalationEngine
 */
const checkAndEscalateComplaints = async (options = {}) => {
  return runEscalationCycle(options);
};

module.exports = {
  getEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  toggleEscalationRule,
  processEscalations,
  checkAndEscalateComplaints,
};