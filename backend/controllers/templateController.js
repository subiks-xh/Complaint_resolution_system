const mongoose = require("mongoose");
const ResponseTemplate = require("../models/ResponseTemplate");
const Complaint = require("../models/Complaint");

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const createTemplate = async (req, res) => {
  try {
    const {
      name,
      body,
      type = "status_update",
      audience = "staff",
      tags = [],
    } = req.body;

    if (!name || !body) {
      return res
        .status(400)
        .json({ success: false, message: "Name and body are required" });
    }

    const template = await ResponseTemplate.create({
      organization: req.user.organization,
      name,
      body,
      type,
      audience,
      tags,
      createdBy: req.user.id,
    });

    return res
      .status(201)
      .json({ success: true, message: "Template created", data: template });
  } catch (error) {
    console.error("createTemplate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create template" });
  }
};

const listTemplates = async (req, res) => {
  try {
    const query = {
      organization: req.user.organization,
      isActive: true,
    };

    if (req.query.type) query.type = req.query.type;

    if (req.user.role === "staff") {
      query.audience = { $in: ["staff", "all"] };
    }

    const templates = await ResponseTemplate.find(query)
      .select("name type body audience tags usageCount updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("listTemplates error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch templates" });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid template ID" });
    }

    const template = await ResponseTemplate.findOne({
      _id: id,
      organization: req.user.organization,
      isActive: true,
    });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    const allowed = ["name", "body", "type", "audience", "tags"];
    allowed.forEach((field) => {
      if (typeof req.body[field] !== "undefined") {
        template[field] = req.body[field];
      }
    });

    await template.save();

    return res
      .status(200)
      .json({ success: true, message: "Template updated", data: template });
  } catch (error) {
    console.error("updateTemplate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update template" });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid template ID" });
    }

    const template = await ResponseTemplate.findOne({
      _id: id,
      organization: req.user.organization,
      isActive: true,
    });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    template.isActive = false;
    await template.save();

    return res
      .status(200)
      .json({ success: true, message: "Template archived" });
  } catch (error) {
    console.error("deleteTemplate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to archive template" });
  }
};

const applyTemplateToComplaint = async (req, res) => {
  try {
    const { templateId, complaintId } = req.params;
    const { mode = "internal_note", setStatus } = req.body;

    if (!isObjectId(templateId) || !isObjectId(complaintId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID provided" });
    }

    const template = await ResponseTemplate.findOne({
      _id: templateId,
      organization: req.user.organization,
      isActive: true,
    });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    const isAdmin = ["admin", "org_admin", "super_admin"].includes(
      req.user.role,
    );
    const isAssignee =
      complaint.assignedTo && complaint.assignedTo.toString() === req.user.id;

    if (!isAdmin && !isAssignee) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only assignee or admin can apply template",
        });
    }

    if (mode === "resolution") {
      complaint.resolution = complaint.resolution || {};
      complaint.resolution.remarks = template.body;
      complaint.resolution.resolvedBy = req.user.id;
    } else {
      complaint.internalNotes.push({
        note: `[TEMPLATE:${template.name}] ${template.body}`,
        addedBy: req.user.id,
        addedAt: new Date(),
      });
    }

    if (
      setStatus &&
      ["assigned", "in-progress", "resolved", "closed", "reopened"].includes(
        setStatus,
      )
    ) {
      complaint.status = setStatus;
    }

    await complaint.save();

    template.usageCount += 1;
    await template.save();

    return res.status(200).json({
      success: true,
      message: "Template applied successfully",
      data: {
        complaintId: complaint._id,
        templateId: template._id,
        mode,
      },
    });
  } catch (error) {
    console.error("applyTemplateToComplaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to apply template" });
  }
};

module.exports = {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  applyTemplateToComplaint,
};
