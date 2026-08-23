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

    // Check if category exists (if provided)
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
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
      organization: req.user.organization,
      createdBy: req.user._id,
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

/**
 * @desc    Check and process escalations for all complaints
 * @route   POST /api/admin/escalation-rules/process
 * @access  Private/Admin (for manual processing)
 */
const processEscalations = async (req, res) => {
  try {
    const results = await checkAndEscalateComplaints();

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
 * This is called by the scheduler and can also be manually triggered
 */
const checkAndEscalateComplaints = async () => {
  try {
    console.log("Starting escalation check...");

    // Get all active escalation rules
    const rules = await EscalationRule.find({ isActive: true })
      .populate("category", "name")
      .lean();

    if (rules.length === 0) {
      console.log("No active escalation rules found");
      return { processedCount: 0, escalatedCount: 0 };
    }

    let processedCount = 0;
    let escalatedCount = 0;

    // Process each rule
    for (const rule of rules) {
      console.log(`Processing rule: ${rule.name}`);

      // Build complaint filter based on rule criteria
      const complaintFilter = {
        status: { $in: ["new", "in_progress"] }, // Only active complaints
        priority: rule.priority,
      };

      // Add organization filter
      if (rule.organization) {
        complaintFilter.organization = rule.organization;
      }

      // Add category filter if specified
      if (rule.category) {
        complaintFilter.category = rule.category._id;
      }

      // Get complaints that match the rule
      const complaints = await Complaint.find(complaintFilter)
        .populate("assignedTo", "firstName lastName")
        .populate("category", "name")
        .lean();

      console.log(`Found ${complaints.length} complaints for rule: ${rule.name}`);

      for (const complaint of complaints) {
        processedCount++;

        const now = new Date();
        const createdAt = new Date(complaint.createdAt);
        const lastUpdate = new Date(complaint.updatedAt || complaint.createdAt);
        
        // Calculate time differences in hours
        const hoursTotal = (now - createdAt) / (1000 * 60 * 60);
        const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

        let shouldEscalate = false;
        let escalationReason = "";

        // Check time threshold
        if (hoursTotal >= rule.conditions.timeThreshold) {
          shouldEscalate = true;
          escalationReason += `Time threshold exceeded (${Math.floor(hoursTotal)}h). `;
        }

        // Check no update threshold
        if (hoursSinceUpdate >= rule.conditions.noUpdateThreshold) {
          shouldEscalate = true;
          escalationReason += `No update for ${Math.floor(hoursSinceUpdate)} hours. `;
        }

        // Check response threshold (for new complaints)
        if (complaint.status === "new" && hoursTotal >= rule.conditions.responseThreshold) {
          shouldEscalate = true;
          escalationReason += `Response threshold exceeded. `;
        }

        if (shouldEscalate) {
          console.log(`Escalating complaint ${complaint.complaintId}: ${escalationReason}`);

          // Execute escalation actions
          const updateData = {
            status: "escalated",
            escalatedAt: now,
            escalationReason: escalationReason.trim(),
            updatedAt: now,
          };

          // Increase priority if specified
          if (rule.actions.increasePriority) {
            if (complaint.priority === "low") updateData.priority = "medium";
            else if (complaint.priority === "medium") updateData.priority = "high";
          }

          // Update the complaint
          await Complaint.findByIdAndUpdate(complaint._id, updateData);

          // Send notifications if specified
          if (rule.actions.sendNotification) {
            await sendEscalationNotification(
              { ...complaint, ...updateData },
              "automatic"
            );
          }

          // Send SLA breach notification for high priority items
          if (complaint.priority === "high" || updateData.priority === "high") {
            await sendSLABreachNotification({ ...complaint, ...updateData });
          }

          escalatedCount++;
        }
      }
    }

    console.log(`Escalation check completed. Processed: ${processedCount}, Escalated: ${escalatedCount}`);

    return {
      processedCount,
      escalatedCount,
      rulesProcessed: rules.length,
      timestamp: new Date(),
    };
  } catch (err) {
    console.error("Check and escalate complaints error:", err);
    throw err;
  }
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