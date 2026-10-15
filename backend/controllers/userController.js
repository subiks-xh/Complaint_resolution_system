/**
 * User Controller
 *
 * Handles user profile and account management:
 * - View and update profile
 * - Notification preferences
 * - Account settings
 * - User statistics
 */

const User = require("../models/User");
const Complaint = require("../models/Complaint");
const Feedback = require("../models/Feedback");
const StaffFeedback = require("../models/StaffFeedback");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const { deleteFromCloudinary } = require("../config/cloudinary");
const mongoose = require("mongoose");

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "specializations",
      "name color icon",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data:
        user.role === "staff" ? user.toStaffProfile() : user.toPublicProfile(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, department, designation, notificationPreferences } =
      req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update allowed fields
    if (name) {
      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Name must be at least 2 characters long",
        });
      }
      user.name = name.trim();
    }

    if (phone !== undefined) {
      if (
        phone &&
        !/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid phone number",
        });
      }
      user.phone = phone?.trim() || null;
    }

    if (department !== undefined) {
      user.department = department?.trim() || null;
    }

    if (designation !== undefined && user.role === "staff") {
      user.designation = designation?.trim() || null;
    }

    if (notificationPreferences) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data:
        user.role === "staff" ? user.toStaffProfile() : user.toPublicProfile(),
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating profile",
    });
  }
};

/**
 * @desc    Update profile avatar
 * @route   PUT /api/users/profile/avatar
 * @access  Private
 */
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar?.publicId) {
      try {
        await deleteFromCloudinary(user.avatar.publicId);
      } catch (err) {
        console.error("Error deleting old avatar:", err);
      }
    }

    // Update avatar with new upload
    user.avatar = {
      url: req.file.path || req.file.location,
      publicId: req.file.filename || req.file.key,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: {
        avatar: user.avatar.url,
      },
    });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating avatar",
    });
  }
};

/**
 * @desc    Delete profile avatar
 * @route   DELETE /api/users/profile/avatar
 * @access  Private
 */
const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.avatar?.publicId) {
      return res.status(400).json({
        success: false,
        message: "No avatar to delete",
      });
    }

    // Delete from Cloudinary
    try {
      await deleteFromCloudinary(user.avatar.publicId);
    } catch (err) {
      console.error("Error deleting avatar from Cloudinary:", err);
    }

    // Clear avatar data
    user.avatar = {
      url: null,
      publicId: null,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Delete avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting avatar",
    });
  }
};

/**
 * @desc    Get user statistics
 * @route   GET /api/users/stats
 * @access  Private
 */
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let stats = {};

    if (userRole === "user") {
      // Get user complaint statistics
      const complaintStats = await Complaint.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            organization: req.user.organization,
          },
        },
        {
          $facet: {
            byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
            total: [{ $count: "count" }],
            recentComplaints: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  complaintId: 1,
                  title: 1,
                  status: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]);

      // Get feedback statistics
      const feedbackStats = await Feedback.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalFeedbacks: { $sum: 1 },
            avgRating: { $avg: "$rating" },
          },
        },
      ]);

      stats = {
        complaints: {
          total: complaintStats[0]?.total[0]?.count || 0,
          byStatus: complaintStats[0]?.byStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          byPriority: complaintStats[0]?.byPriority.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          recent: complaintStats[0]?.recentComplaints || [],
        },
        feedback: feedbackStats[0] || { totalFeedbacks: 0, avgRating: 0 },
      };
    } else if (userRole === "staff") {
      stats = await User.getStaffStats(userId);
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
    });
  }
};

/**
 * @desc    Get user notifications
 * @route   GET /api/users/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    const { page = 1, limit = 20, unreadOnly = "false", type } = req.query;

    const notifications = await Notification.getForUser(req.user.id, {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      unreadOnly: unreadOnly === "true",
      type,
    });

    const total = await Notification.countDocuments({
      recipient: req.user.id,
      isArchived: false,
      ...(unreadOnly === "true" && { isRead: false }),
      ...(type && { type }),
    });

    const stats = await Notification.getUserStats(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications.map((n) => n.toDisplay()),
        stats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/users/notifications/:id/read
 * @access  Private
 */
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating notification",
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/users/notifications/read-all
 * @access  Private
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    const count = await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: `${count} notifications marked as read`,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating notifications",
    });
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/users/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
    });
  }
};

/**
 * @desc    Get notification preferences
 * @route   GET /api/users/notification-preferences
 * @access  Private
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notificationPreferences");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const preferences = user.notificationPreferences || {
      email: true,
      inApp: true,
      complaintUpdates: true,
      escalationAlerts: true,
    };

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving preferences",
    });
  }
};

/**
 * @desc    Update notification preferences
 * @route   PUT /api/users/notification-preferences
 * @access  Private
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const { email, inApp, complaintUpdates, escalationAlerts } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {
        email: true,
        inApp: true,
        complaintUpdates: true,
        escalationAlerts: true,
      };
    }

    // Update preferences
    if (email !== undefined) user.notificationPreferences.email = Boolean(email);
    if (inApp !== undefined) user.notificationPreferences.inApp = Boolean(inApp);
    if (complaintUpdates !== undefined)
      user.notificationPreferences.complaintUpdates = Boolean(complaintUpdates);
    if (escalationAlerts !== undefined)
      user.notificationPreferences.escalationAlerts = Boolean(escalationAlerts);

    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      data: user.notificationPreferences,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating preferences",
    });
  }
};

/**
 * @desc    Get user by ID (admin/staff)
 * @route   GET /api/users/:id
 * @access  Private/Admin/Staff
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password -refreshToken -resetPasswordToken")
      .populate("specializations", "name color");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Staff can only view user profiles, not other staff/admins
    if (req.user.role === "staff" && user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: user.toPublicProfile(),
    });
  } catch (error) {
    console.error("Get user by ID error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching user",
    });
  }
};

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Organization filter: Super Admin sees all, Org Admin sees their own
    if (req.user.role !== "super_admin") {
      query.organization = req.user.organization;
    }

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -refreshToken -resetPasswordToken")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: users.map((u) => u.toPublicProfile()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
};

/**
 * @desc    Update user by ID (admin only)
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      department,
      designation,
      role,
      isActive,
      specializations,
      maxAssignedComplaints,
    } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent changing own role
    if (id === req.user.id && role && role !== user.role) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone?.trim() || null;
    if (department !== undefined) user.department = department?.trim() || null;
    if (designation !== undefined)
      user.designation = designation?.trim() || null;
    if (
      role &&
      ["user", "staff", "admin", "org_admin", "super_admin"].includes(role)
    )
      user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (specializations !== undefined && user.role === "staff") {
      user.specializations = specializations;
    }
    if (maxAssignedComplaints !== undefined && user.role === "staff") {
      user.maxAssignedComplaints = maxAssignedComplaints;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user.toPublicProfile(),
    });
  } catch (error) {
    console.error("Update user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
    });
  }
};

/**
 * @desc    Delete user (admin only)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check for active assignments (for staff)
    if (user.role === "staff") {
      const activeAssignments = await Complaint.countDocuments({
        assignedTo: id,
        status: { $in: ["assigned", "in-progress"] },
      });

      if (activeAssignments > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete staff with ${activeAssignments} active assignments`,
        });
      }
    }

    // Delete avatar from Cloudinary
    if (user.avatar?.publicId) {
      try {
        await deleteFromCloudinary(user.avatar.publicId);
      } catch (err) {
        console.error("Error deleting avatar:", err);
      }
    }

    // Delete user's notifications
    await Notification.deleteMany({ recipient: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
    });
  }
};

/**
 * @desc    Deactivate own account
 * @route   PUT /api/users/deactivate
 * @access  Private
 */
const deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Please provide your password to confirm",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Deactivate account
    user.isActive = false;
    user.refreshToken = undefined;
    await user.save();

    // Clear cookie
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate account error:", error);
    res.status(500).json({
      success: false,
      message: "Error deactivating account",
    });
  }
};

/**
 * @desc    Add staff feedback (user side)
 * @route   POST /api/users/staff-feedback/:staffId
 * @access  Private/User
 */
const addStaffFeedback = async (req, res) => {
  try {
    const { staffId } = req.params;
    const {
      rating,
      comment,
      category = "general",
      isAnonymous = false,
      relatedComplaint,
    } = req.body;

    // Verify staff member exists and is active
    const staff = await User.findOne({
      _id: staffId,
      role: "staff",
      isActive: true,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found or inactive",
      });
    }

    // Validate related complaint if provided
    let complaint = null;
    if (relatedComplaint) {
      complaint = await Complaint.findOne({
        _id: relatedComplaint,
        user: req.user.id,
        assignedTo: staffId,
      });

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message:
            "Related complaint not found or not assigned to this staff member",
        });
      }

      // Check if user has already given feedback for this complaint-staff combination
      const existingFeedback = await StaffFeedback.findOne({
        staffMember: staffId,
        givenBy: req.user.id,
        relatedComplaint: relatedComplaint,
      });

      if (existingFeedback) {
        return res.status(400).json({
          success: false,
          message:
            "You have already provided feedback for this staff member on this complaint",
        });
      }
    } else {
      // For general feedback, check if user has interacted with this staff member
      const hasInteraction = await Complaint.exists({
        user: req.user.id,
        assignedTo: staffId,
        status: { $in: ["resolved", "closed"] },
      });

      if (!hasInteraction) {
        return res.status(403).json({
          success: false,
          message:
            "You can only provide feedback for staff members who have handled your complaints",
        });
      }

      // Limit general feedback to once per month per staff member
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const recentFeedback = await StaffFeedback.findOne({
        staffMember: staffId,
        givenBy: req.user.id,
        relatedComplaint: null,
        createdAt: { $gte: oneMonthAgo },
      });

      if (recentFeedback) {
        return res.status(400).json({
          success: false,
          message:
            "You can provide general feedback for a staff member only once per month",
        });
      }
    }

    // Create feedback
    const feedback = new StaffFeedback({
      staffMember: staffId,
      givenBy: req.user.id,
      feedbackType: "user",
      rating,
      comment,
      category,
      isAnonymous,
      relatedComplaint,
      metadata: {
        submissionSource: "user_portal",
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
      },
    });

    await feedback.save();

    // Populate the feedback for response
    await feedback.populate([
      { path: "givenBy", select: "name email" },
      { path: "relatedComplaint", select: "complaintId title" },
    ]);

    // Create notification for staff member (optional)
    try {
      await notificationService.sendInAppNotification({
        recipient: staffId,
        type: "feedback_received",
        title: "New Feedback Received",
        message: `You received ${rating}-star feedback from a ${isAnonymous ? "user" : req.user.name}`,
        relatedId: feedback._id,
        relatedModel: "StaffFeedback",
      });
    } catch (notificationError) {
      console.error(
        "Failed to create feedback notification:",
        notificationError,
      );
      // Don't fail the request if notification creation fails
    }

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback.isAnonymous ? feedback.toSafeObject() : feedback,
    });
  } catch (error) {
    console.error("Add staff feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting feedback",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
  getUserStats,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  getUserById,
  getAllUsers,
  updateUserById,
  deleteUser,
  deactivateAccount,
  addStaffFeedback,
};
