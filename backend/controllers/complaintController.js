/**
 * Complaint Controller
 *
 * Handles all complaint-related operations:
 * - Create, read, update complaints
 * - File attachments
 * - Status tracking
 * - User complaint management
 */

const Complaint = require("../models/Complaint");
const Category = require("../models/Category");
const User = require("../models/User");
const Notification = require("../models/Notification");
const {
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
} = require("../config/cloudinary");
const mongoose = require("mongoose");

/**
 * @desc    Create a new complaint
 * @route   POST /api/complaints
 * @access  Private/User
 */
const createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, location, tags } = req.body;

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide title, description, and category",
      });
    }

    // Validate title length
    if (title.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 5 characters long",
      });
    }

    // Validate description length
    if (description.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "Description must be at least 20 characters long",
      });
    }

    // Validate category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid category selected",
      });
    }

    if (!categoryDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: "This category is no longer available",
      });
    }

    // Check if category requires attachment
    if (
      categoryDoc.requiresAttachment &&
      (!req.files || req.files.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "This category requires at least one attachment",
      });
    }

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({
          success: false,
          message: "You can upload a maximum of 5 attachments per complaint",
        });
      }

      for (const file of req.files) {
        attachments.push({
          filename: file.filename || file.key || file.originalname,
          originalName: file.originalname,
          url: file.path || file.location || file.secure_url,
          publicId: file.filename || file.key || file.public_id,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date(),
        });
      }
    }

    // Determine priority (use category default if not specified)
    const complaintPriority =
      priority || categoryDoc.defaultPriority || "medium";

    // Validate priority value
    if (!["low", "medium", "high", "critical"].includes(complaintPriority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority level",
      });
    }

    // Calculate resolution deadline based on SLA
    const slaHours = categoryDoc.resolutionSLA?.[complaintPriority] || 48;
    const resolutionDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    // Parse location if provided as string
    let parsedLocation = location;
    if (typeof location === "string") {
      try {
        parsedLocation = JSON.parse(location);
      } catch (e) {
        parsedLocation = { address: location };
      }
    }

    // Parse tags if provided as string
    let parsedTags = tags;
    if (typeof tags === "string") {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    // Verify user belongs to an organization
    if (!req.user.organization) {
      return res.status(400).json({
        success: false,
        message:
          "Your account is not associated with any organization. Cannot submit complaint.",
      });
    }

    // Create complaint
    const complaint = await Complaint.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority: complaintPriority,
      user: req.user.id,
      organization: req.user.organization,
      attachments,
      location: parsedLocation || {},
      tags: parsedTags || [],
      resolutionDeadline,
      timeline: {
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      statusHistory: [
        {
          status: "new",
          changedBy: req.user.id,
          changedByRole: "user",
          remarks: "Complaint submitted",
          changedAt: new Date(),
        },
      ],
    });

    // Send notifications (non-blocking)
    try {
      // Send notification to user
      await Notification.createFromTemplate({
        type: "complaint_submitted",
        recipient: req.user.id,
        complaint: complaint._id,
        customData: {
          complaintTitle: complaint.title,
          complaintId: complaint.complaintId,
        },
      });

      // Notify admins about new complaint
      const admins = await User.find({
        role: "org_admin",
        isActive: true,
        organization: req.user.organization,
      }).select("_id");

      // Also notify staff who might subscribe to this category
      const categoryStaff = await User.find({
        role: "staff",
        isActive: true,
        specializations: category,
        organization: req.user.organization,
      }).select("_id");

      const recipients = [...admins, ...categoryStaff];

      const adminNotifications = recipients.map((recipient) => ({
        recipient: recipient._id,
        type: "complaint_submitted",
        title: "New Complaint Received",
        message: `New ${complaintPriority} priority complaint "${complaint.complaintId}": ${complaint.title}`,
        priority:
          complaintPriority === "critical"
            ? "urgent"
            : complaintPriority === "high"
              ? "high"
              : "normal",
        relatedComplaint: complaint._id,
        actionUrl: `/admin/complaints/${complaint._id}`,
        metadata: {
          complaintId: complaint.complaintId,
          priority: complaintPriority,
          category: categoryDoc.name,
        },
      }));

      if (adminNotifications.length > 0) {
        await Notification.insertMany(adminNotifications);
      }
    } catch (notifError) {
      console.error("Notification Error:", notifError);
      // Continue execution - don't fail the request just because notification failed
    }

    // Populate and return
    await complaint.populate([
      { path: "category", select: "name color icon" },
      { path: "user", select: "name email" },
    ]);

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Create complaint error details:", error);

    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      const publicIds = req.files
        .map((f) => f.filename || f.key || f.public_id)
        .filter(Boolean);
      if (publicIds.length > 0) {
        try {
          await deleteMultipleFromCloudinary(publicIds);
        } catch (err) {
          console.error("Error cleaning up files:", err);
        }
      }
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data provided (ID format error).",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error submitting complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get all complaints for logged-in user
 * @route   GET /api/complaints/my-complaints
 * @access  Private/User
 */
const getMyComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = { user: req.user.id, isArchived: false };

    // Status filter
    if (status) {
      if (status.includes(",")) {
        query.status = { $in: status.split(",").map((s) => s.trim()) };
      } else {
        query.status = status;
      }
    }

    // Priority filter
    if (priority) {
      if (priority.includes(",")) {
        query.priority = { $in: priority.split(",").map((p) => p.trim()) };
      } else {
        query.priority = priority;
      }
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { complaintId: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
      ];
    }

    // Build sort
    const sort = {};
    const validSortFields = [
      "createdAt",
      "updatedAt",
      "priority",
      "status",
      "title",
    ];
    if (validSortFields.includes(sortBy)) {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate("category", "name color icon")
        .populate("assignedTo", "name email avatar")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Complaint.countDocuments(query),
    ]);

    // Add computed fields
    const now = new Date();
    const complaintsWithExtras = complaints.map((complaint) => ({
      ...complaint,
      isOverdue:
        complaint.resolutionDeadline &&
        now > new Date(complaint.resolutionDeadline) &&
        !["resolved", "closed"].includes(complaint.status),
      hasFeedback: !!complaint.feedback,
      ageInDays: Math.floor(
        (now - new Date(complaint.createdAt)) / (1000 * 60 * 60 * 24),
      ),
      canReopen:
        ["resolved", "closed"].includes(complaint.status) &&
        complaint.reopenCount < 3,
    }));

    res.status(200).json({
      success: true,
      data: {
        complaints: complaintsWithExtras,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: skip + complaints.length < total,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get my complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching complaints",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get single complaint by ID
 * @route   GET /api/complaints/:id
 * @access  Private
 */
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find by _id or complaintId
    let complaint;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findOne({
        _id: id,
        organization: req.user.organization,
      });
    }

    if (!complaint) {
      complaint = await Complaint.findOne({
        complaintId: id.toUpperCase(),
        organization: req.user.organization,
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check authorization
    const isOwner = complaint.user.toString() === req.user.id;
    const isAssignee = complaint.assignedTo?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isStaff = req.user.role === "staff";

    if (!isOwner && !isAssignee && !isAdmin && !isStaff) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this complaint",
      });
    }

    // Populate based on role
    await complaint.populate([
      { path: "user", select: "name email phone avatar department" },
      {
        path: "assignedTo",
        select: "name email department avatar designation",
      },
      { path: "assignedBy", select: "name email" },
      { path: "category", select: "name color icon description resolutionSLA" },
      {
        path: "feedback",
        select: "rating comments satisfactionLevel createdAt",
      },
      { path: "statusHistory.changedBy", select: "name role" },
      { path: "escalationHistory.escalatedBy", select: "name" },
      { path: "escalationHistory.previousAssignee", select: "name" },
      { path: "escalationHistory.reassignedTo", select: "name" },
      { path: "resolution.resolvedBy", select: "name email" },
    ]);

    // Build response
    let responseData = complaint.toObject();

    // Hide internal notes from regular users
    if (req.user.role === "user") {
      delete responseData.internalNotes;
    } else {
      // Populate internal notes authors for staff/admin
      if (responseData.internalNotes && responseData.internalNotes.length > 0) {
        const noteAuthors = await User.find({
          _id: { $in: responseData.internalNotes.map((n) => n.addedBy) },
        })
          .select("name role")
          .lean();

        const authorMap = noteAuthors.reduce((acc, author) => {
          acc[author._id.toString()] = author;
          return acc;
        }, {});

        responseData.internalNotes = responseData.internalNotes.map((note) => ({
          ...note,
          addedBy: authorMap[note.addedBy?.toString()] || note.addedBy,
        }));
      }
    }

    // Add computed fields
    responseData.isOverdue = complaint.isOverdue;
    responseData.ageInDays = complaint.ageInDays;
    responseData.ageInHours = complaint.ageInHours;
    responseData.timeRemaining = complaint.timeRemaining;
    responseData.resolutionTime = complaint.resolutionTime;
    const workBase = complaint?.workTracking?.totalSeconds || 0;
    const activeStart = complaint?.workTracking?.activeSessionStartedAt;
    const workLive = activeStart
      ? Math.floor((Date.now() - new Date(activeStart).getTime()) / 1000)
      : 0;
    responseData.workTracking = {
      ...(responseData.workTracking || {}),
      currentWorkedSeconds: Math.max(0, workBase + workLive),
      isActive: !!activeStart,
    };
    responseData.canReopen =
      ["resolved", "closed"].includes(complaint.status) &&
      complaint.reopenCount < 3 &&
      isOwner;
    responseData.canEdit = complaint.status === "new" && isOwner;
    responseData.canCancel =
      !["resolved", "closed"].includes(complaint.status) && isOwner;
    responseData.needsFeedback =
      ["resolved", "closed"].includes(complaint.status) &&
      !complaint.feedback &&
      isOwner;

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get complaint error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update complaint (user can only update certain fields before assignment)
 * @route   PUT /api/complaints/:id
 * @access  Private/User
 */
const updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, location, tags } = req.body;

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify ownership
    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this complaint",
      });
    }

    // Can only update if status is 'new'
    if (complaint.status !== "new") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update complaint after it has been assigned. Contact support for changes.",
      });
    }

    // Track what was updated
    const updates = [];

    // Update allowed fields
    if (title !== undefined) {
      if (title.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 5 characters long",
        });
      }
      if (complaint.title !== title.trim()) {
        updates.push(`Title updated`);
        complaint.title = title.trim();
      }
    }

    if (description !== undefined) {
      if (description.trim().length < 20) {
        return res.status(400).json({
          success: false,
          message: "Description must be at least 20 characters long",
        });
      }
      if (complaint.description !== description.trim()) {
        updates.push(`Description updated`);
        complaint.description = description.trim();
      }
    }

    if (
      priority !== undefined &&
      ["low", "medium", "high", "critical"].includes(priority)
    ) {
      if (complaint.priority !== priority) {
        updates.push(
          `Priority changed from ${complaint.priority} to ${priority}`,
        );
        complaint.priority = priority;

        // Recalculate deadline based on new priority
        await complaint.populate("category");
        if (complaint.category && complaint.category.resolutionSLA) {
          const slaHours = complaint.category.resolutionSLA[priority] || 48;
          complaint.resolutionDeadline = new Date(
            Date.now() + slaHours * 60 * 60 * 1000,
          );
        }
      }
    }

    if (location !== undefined) {
      complaint.location =
        typeof location === "string" ? { address: location } : location;
      updates.push("Location updated");
    }

    if (tags !== undefined) {
      const parsedTags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim());
      complaint.tags = parsedTags.filter(Boolean);
      updates.push("Tags updated");
    }

    // Only save if there were actual updates
    if (updates.length > 0) {
      complaint.timeline.lastUpdatedAt = new Date();

      // Add to status history
      complaint.statusHistory.push({
        status: complaint.status,
        changedBy: req.user.id,
        changedByRole: "user",
        remarks: `Complaint updated: ${updates.join(", ")}`,
        changedAt: new Date(),
      });

      await complaint.save();
    }

    await complaint.populate([{ path: "category", select: "name color icon" }]);

    res.status(200).json({
      success: true,
      message:
        updates.length > 0
          ? "Complaint updated successfully"
          : "No changes made",
      data: complaint,
    });
  } catch (error) {
    console.error("Update complaint error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Add attachment to complaint
 * @route   POST /api/complaints/:id/attachments
 * @access  Private
 */
const addAttachment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one file",
      });
    }

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      // Clean up uploaded files
      if (req.files) {
        const publicIds = req.files
          .map((f) => f.filename || f.key)
          .filter(Boolean);
        if (publicIds.length > 0) {
          await deleteMultipleFromCloudinary(publicIds).catch(console.error);
        }
      }

      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check authorization
    const isOwner = complaint.user.toString() === req.user.id;
    const isAssignee = complaint.assignedTo?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAssignee && !isAdmin) {
      // Clean up uploaded files
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }

      return res.status(403).json({
        success: false,
        message: "Not authorized to add attachments to this complaint",
      });
    }

    // Check attachment limit
    const maxAttachments = 10;
    if (complaint.attachments.length + req.files.length > maxAttachments) {
      // Clean up uploaded files
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: `Maximum ${maxAttachments} attachments allowed per complaint. Currently have ${complaint.attachments.length}.`,
      });
    }

    // Add new attachments
    const newAttachments = [];
    for (const file of req.files) {
      const attachment = {
        filename: file.filename || file.key || file.originalname,
        originalName: file.originalname,
        url: file.path || file.location || file.secure_url,
        publicId: file.filename || file.key || file.public_id,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      };
      complaint.attachments.push(attachment);
      newAttachments.push(attachment);
    }

    complaint.timeline.lastUpdatedAt = new Date();

    // Add to status history
    complaint.statusHistory.push({
      status: complaint.status,
      changedBy: req.user.id,
      changedByRole: req.user.role,
      remarks: `Added ${req.files.length} attachment(s)`,
      changedAt: new Date(),
    });

    await complaint.save();

    res.status(200).json({
      success: true,
      message: `${req.files.length} attachment(s) added successfully`,
      data: {
        attachments: complaint.attachments,
        newAttachments,
      },
    });
  } catch (error) {
    console.error("Add attachment error:", error);

    // Clean up uploaded files on error
    if (req.files) {
      const publicIds = req.files
        .map((f) => f.filename || f.key)
        .filter(Boolean);
      if (publicIds.length > 0) {
        await deleteMultipleFromCloudinary(publicIds).catch(console.error);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error adding attachments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Delete attachment from complaint
 * @route   DELETE /api/complaints/:id/attachments/:attachmentId
 * @access  Private
 */
const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check authorization
    const isOwner = complaint.user.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete attachments from this complaint",
      });
    }

    // User can only delete if complaint is new
    if (isOwner && !isAdmin && complaint.status !== "new") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete attachment after complaint has been assigned",
      });
    }

    // Find attachment
    const attachment = complaint.attachments.id(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    const attachmentName = attachment.originalName;

    // Delete from Cloudinary
    if (attachment.publicId) {
      try {
        await deleteFromCloudinary(attachment.publicId);
      } catch (err) {
        console.error("Error deleting from Cloudinary:", err);
        // Continue even if Cloudinary delete fails
      }
    }

    // Remove from complaint
    complaint.attachments.pull(attachmentId);
    complaint.timeline.lastUpdatedAt = new Date();

    // Add to status history
    complaint.statusHistory.push({
      status: complaint.status,
      changedBy: req.user.id,
      changedByRole: req.user.role,
      remarks: `Deleted attachment: ${attachmentName}`,
      changedAt: new Date(),
    });

    await complaint.save();

    res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
      data: {
        attachments: complaint.attachments,
      },
    });
  } catch (error) {
    console.error("Delete attachment error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting attachment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Cancel/withdraw complaint
 * @route   PUT /api/complaints/:id/cancel
 * @access  Private/User
 */
const cancelComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const complaint = await Complaint.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify ownership
    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this complaint",
      });
    }

    // Can only cancel if not resolved/closed
    if (["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a resolved or closed complaint",
      });
    }

    const previousStatus = complaint.status;
    const previousAssignee = complaint.assignedTo;

    // Update status to closed with cancellation note
    complaint.status = "closed";
    complaint.timeline.closedAt = new Date();
    complaint.timeline.lastUpdatedAt = new Date();

    complaint.statusHistory.push({
      status: "closed",
      changedBy: req.user.id,
      changedByRole: "user",
      remarks: `Complaint withdrawn by user. Reason: ${reason || "Not specified"}`,
      changedAt: new Date(),
    });

    // Add internal note
    complaint.internalNotes.push({
      note: `Complaint cancelled/withdrawn by user from status "${previousStatus}". Reason: ${reason || "Not specified"}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });

    await complaint.save();

    // Notify assignee if any
    if (previousAssignee) {
      await Notification.create({
        recipient: previousAssignee,
        type: "complaint_closed",
        title: "Complaint Withdrawn",
        message: `Complaint "${complaint.complaintId}" has been withdrawn by the user.`,
        priority: "normal",
        relatedComplaint: complaint._id,
        actionUrl: `/staff/complaints/${complaint._id}`,
      });
    }

    // Notify admins
    const admins = await User.find({
      role: "org_admin", // Changed from admin to org_admin
      isActive: true,
      organization: req.user.organization, // Filter by Org
    }).select("_id");
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: "complaint_closed",
        title: "Complaint Withdrawn",
        message: `Complaint "${complaint.complaintId}" was withdrawn by the user.`,
        priority: "low",
        relatedComplaint: complaint._id,
      });
    }

    await complaint.populate([{ path: "category", select: "name color" }]);

    res.status(200).json({
      success: true,
      message: "Complaint cancelled successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Cancel complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Reopen a resolved complaint
 * @route   PUT /api/complaints/:id/reopen
 * @access  Private/User
 */
const reopenComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a detailed reason for reopening (at least 10 characters)",
      });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Verify ownership
    if (complaint.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reopen this complaint",
      });
    }

    // Can only reopen if resolved or closed
    if (!["resolved", "closed"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Can only reopen resolved or closed complaints",
      });
    }

    // Check reopen limit
    const maxReopens = 3;
    if (complaint.reopenCount >= maxReopens) {
      return res.status(400).json({
        success: false,
        message: `This complaint has been reopened ${maxReopens} times. Please create a new complaint for further issues.`,
      });
    }

    // Check if within reopen window (7 days after resolution)
    const resolutionDate =
      complaint.timeline.resolvedAt || complaint.timeline.closedAt;
    const reopenWindowDays = 7;
    const reopenWindow = reopenWindowDays * 24 * 60 * 60 * 1000;

    if (
      resolutionDate &&
      Date.now() - new Date(resolutionDate) > reopenWindow
    ) {
      return res.status(400).json({
        success: false,
        message: `Reopen window of ${reopenWindowDays} days has expired. Please create a new complaint.`,
      });
    }

    const previousStatus = complaint.status;

    // Reopen complaint
    complaint.status = "reopened";
    complaint.timeline.reopenedAt = new Date();
    complaint.timeline.lastUpdatedAt = new Date();
    complaint.reopenCount += 1;

    // Reset SLA breach flag and recalculate deadline
    complaint.slaBreached = false;
    await complaint.populate("category");
    if (complaint.category && complaint.category.resolutionSLA) {
      const slaHours =
        complaint.category.resolutionSLA[complaint.priority] || 48;
      complaint.resolutionDeadline = new Date(
        Date.now() + slaHours * 60 * 60 * 1000,
      );
    }

    complaint.statusHistory.push({
      status: "reopened",
      changedBy: req.user.id,
      changedByRole: "user",
      remarks: `Reopened (attempt ${complaint.reopenCount}). Reason: ${reason.trim()}`,
      changedAt: new Date(),
    });

    // Clear previous feedback reference but keep the feedback document
    complaint.feedback = undefined;
    complaint.resolution.satisfaction = "pending";

    await complaint.save();

    // Collect users to notify
    const notifyUsers = new Set();

    // Notify previous assignee
    if (complaint.assignedTo) {
      notifyUsers.add(complaint.assignedTo.toString());
    }

    // Notify admins
    const admins = await User.find({
      role: { $in: ["admin", "org_admin", "super_admin"] },
      isActive: true,
    }).select("_id");
    admins.forEach((admin) => notifyUsers.add(admin._id.toString()));

    // Send notifications
    for (const userId of notifyUsers) {
      await Notification.create({
        recipient: userId,
        type: "complaint_reopened",
        title: "Complaint Reopened",
        message: `Complaint "${complaint.complaintId}" has been reopened by the user. Reason: ${reason.trim()}`,
        priority: "high",
        relatedComplaint: complaint._id,
        actionUrl:
          complaint.assignedTo?.toString() === userId
            ? `/staff/complaints/${complaint._id}`
            : `/admin/complaints/${complaint._id}`,
        metadata: {
          previousStatus,
          reopenCount: complaint.reopenCount,
          reason: reason.trim(),
        },
      });
    }

    await complaint.populate([
      { path: "category", select: "name color icon" },
      { path: "assignedTo", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Complaint reopened successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Reopen complaint error:", error);
    res.status(500).json({
      success: false,
      message: "Error reopening complaint",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get complaint statistics for user
 * @route   GET /api/complaints/my-stats
 * @access  Private/User
 */
const getMyComplaintStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const stats = await Complaint.aggregate([
      { $match: { user: userId, isArchived: false } },
      {
        $facet: {
          // Count by status
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          // Count by priority
          byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
          // Count by category
          byCategory: [
            { $group: { _id: "$category", count: { $sum: 1 } } },
            {
              $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $unwind: {
                path: "$categoryInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                count: 1,
                name: "$categoryInfo.name",
                color: "$categoryInfo.color",
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          // Total count
          total: [{ $count: "count" }],
          // Overdue count
          overdue: [
            {
              $match: {
                status: { $nin: ["resolved", "closed"] },
                resolutionDeadline: { $lt: new Date() },
              },
            },
            { $count: "count" },
          ],
          // Pending feedback count
          pendingFeedback: [
            {
              $match: {
                status: { $in: ["resolved", "closed"] },
                feedback: { $exists: false },
              },
            },
            { $count: "count" },
          ],
          // Recent complaints
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $unwind: {
                path: "$categoryInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                complaintId: 1,
                title: 1,
                status: 1,
                priority: 1,
                createdAt: 1,
                category: {
                  name: "$categoryInfo.name",
                  color: "$categoryInfo.color",
                },
              },
            },
          ],
          // Monthly trend (last 6 months)
          monthlyTrend: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          // Average resolution time (for resolved complaints)
          avgResolutionTime: [
            {
              $match: {
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
                    3600000, // Convert to hours
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                avgHours: { $avg: "$resolutionTime" },
                minHours: { $min: "$resolutionTime" },
                maxHours: { $max: "$resolutionTime" },
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0];

    // Format response
    const formattedStats = {
      total: result.total[0]?.count || 0,
      overdue: result.overdue[0]?.count || 0,
      pendingFeedback: result.pendingFeedback[0]?.count || 0,
      byStatus: result.byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: result.byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byCategory: result.byCategory,
      recent: result.recent,
      monthlyTrend: result.monthlyTrend,
      resolutionTime: result.avgResolutionTime[0] || {
        avgHours: 0,
        minHours: 0,
        maxHours: 0,
      },
    };

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error("Get complaint stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Search complaints
 * @route   GET /api/complaints/search
 * @access  Private
 */
const searchComplaints = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    // Build base query based on user role
    let baseQuery = { isArchived: false };

    if (req.user.role === "user") {
      baseQuery.user = req.user.id;
    } else if (req.user.role === "staff") {
      baseQuery.$or = [{ assignedTo: req.user.id }, { user: req.user.id }];
    }
    // Admin can search all

    const complaints = await Complaint.find({
      ...baseQuery,
      $text: { $search: q },
    })
      .select("complaintId title status priority category createdAt")
      .populate("category", "name color")
      .sort({ score: { $meta: "textScore" } })
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: {
        query: q,
        count: complaints.length,
        complaints,
      },
    });
  } catch (error) {
    console.error("Search complaints error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching complaints",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get complaint timeline/history
 * @route   GET /api/complaints/:id/timeline
 * @access  Private
 */
const getComplaintTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findById(id)
      .select(
        "complaintId title statusHistory escalationHistory timeline user assignedTo",
      )
      .populate("statusHistory.changedBy", "name role avatar")
      .populate("escalationHistory.escalatedBy", "name")
      .populate("escalationHistory.previousAssignee", "name")
      .populate("escalationHistory.reassignedTo", "name");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check authorization
    const isOwner = complaint.user.toString() === req.user.id;
    const isAssignee = complaint.assignedTo?.toString() === req.user.id;
    const isAdminOrStaff = ["admin", "staff"].includes(req.user.role);

    if (!isOwner && !isAssignee && !isAdminOrStaff) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this complaint timeline",
      });
    }

    // Build unified timeline
    const timeline = [];

    // Add submission event
    timeline.push({
      type: "submitted",
      date: complaint.timeline.submittedAt,
      title: "Complaint Submitted",
      description: "Complaint was created and submitted",
    });

    // Add status history events
    complaint.statusHistory.forEach((entry) => {
      timeline.push({
        type: "status_change",
        date: entry.changedAt,
        title: `Status: ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}`,
        description: entry.remarks || `Status changed to ${entry.status}`,
        user: entry.changedBy,
        role: entry.changedByRole,
      });
    });

    // Add escalation events
    complaint.escalationHistory.forEach((entry) => {
      timeline.push({
        type: "escalation",
        date: entry.escalatedAt,
        title: `Escalation Level ${entry.escalationLevel}`,
        description: entry.reason,
        escalationType: entry.escalationType,
        previousAssignee: entry.previousAssignee,
        reassignedTo: entry.reassignedTo,
      });
    });

    // Add key timeline events
    if (complaint.timeline.assignedAt) {
      timeline.push({
        type: "assigned",
        date: complaint.timeline.assignedAt,
        title: "Complaint Assigned",
        description: "Complaint was assigned to staff",
      });
    }

    if (complaint.timeline.firstResponseAt) {
      timeline.push({
        type: "first_response",
        date: complaint.timeline.firstResponseAt,
        title: "First Response",
        description: "Staff started working on the complaint",
      });
    }

    if (complaint.timeline.resolvedAt) {
      timeline.push({
        type: "resolved",
        date: complaint.timeline.resolvedAt,
        title: "Complaint Resolved",
        description: "Complaint was marked as resolved",
      });
    }

    if (complaint.timeline.closedAt) {
      timeline.push({
        type: "closed",
        date: complaint.timeline.closedAt,
        title: "Complaint Closed",
        description: "Complaint was closed",
      });
    }

    if (complaint.timeline.reopenedAt) {
      timeline.push({
        type: "reopened",
        date: complaint.timeline.reopenedAt,
        title: "Complaint Reopened",
        description: "Complaint was reopened by user",
      });
    }

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaintId,
        title: complaint.title,
        timeline,
      },
    });
  } catch (error) {
    console.error("Get complaint timeline error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching timeline",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Export all functions
module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  updateComplaint,
  addAttachment,
  deleteAttachment,
  cancelComplaint,
  reopenComplaint,
  getMyComplaintStats,
  searchComplaints,
  getComplaintTimeline,
};
