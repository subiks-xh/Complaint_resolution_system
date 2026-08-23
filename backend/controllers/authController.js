/**
 * Authentication Controller
 *
 * Handles all authentication-related operations:
 * - User registration
 * - User login
 * - Token refresh
 * - Logout
 * - Password reset
 * - Email verification
 */

const User = require("../models/User");
const Organization = require("../models/Organization");
const Notification = require("../models/Notification");
const {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyRefreshToken,
  getCookieOptions,
} = require("../config/jwt");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../utils/sendEmail");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const setAuthCookiesAndResponse = async (res, user, message) => {
  const { accessToken, refreshToken } = generateTokenPair(user);
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

  return {
    success: true,
    message,
    data: {
      user: user.toPublicProfile(),
      accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
    },
  };
};

/**
 * @desc    Register a new Organization (Workspace) and Admin
 * @route   POST /api/auth/register-org
 * @access  Public
 */
const registerOrganization = async (req, res) => {
  // NOTE: Removed transactions to support standalone MongoDB instances
  // const session = await User.startSession();
  // session.startTransaction();

  let createdOrg = null;

  try {
    const {
      orgName,
      orgEmail,
      adminName,
      adminEmail,
      adminPassword,
      adminPhone,
    } = req.body;

    // Validate required fields
    if (!orgName || !orgEmail || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({
      email: adminEmail.toLowerCase(),
    });
    if (existingUser) {
      // await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Generate unique org code
    const orgCode = Organization.generateCode(orgName);

    // Create Organization
    createdOrg = await Organization.create({
      name: orgName,
      email: orgEmail,
      code: orgCode,
      status: "active",
    });

    // Create Admin User
    const user = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      phone: adminPhone,
      role: "org_admin",
      organization: createdOrg._id,
      isEmailVerified: true, // Auto-verify for now or send email
    });

    // await session.commitTransaction();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: "Organization registered successfully",
      data: {
        organization: {
          id: createdOrg._id,
          name: createdOrg.name,
          code: createdOrg.code,
        },
        user: user.toPublicProfile(),
        accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
      },
    });
  } catch (error) {
    // Manual rollback if org was created but user failed
    if (createdOrg) {
      await Organization.findByIdAndDelete(createdOrg._id).catch(console.error);
    }
    // await session.abortTransaction();
    console.error("Org Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating organization",
      error: error.message,
    });
  }
};

/**
 * @desc    Register a new user (Join an Organization)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, department, orgCode } = req.body;

    // Validate required fields
    if (!name || !email || !password || !orgCode) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, password, and organization code",
      });
    }

    // Find Organization
    const organization = await Organization.findOne({
      code: orgCode.toUpperCase(),
    });
    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "Invalid Organization Code",
      });
    }

    if (organization.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Organization is not active",
      });
    }

    // ... rest of validation logic ...

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create new user linked to Organization
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      department: department?.trim(),
      role: "user",
      organization: organization._id,
      isOnboarded: true,
      onboardingCompletedAt: new Date(),
    });

    // ... tokens generation ...
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // ... notifications ...

    // Set cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

    // Send response
    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: user.toPublicProfile(),
        organization: {
          id: organization._id,
          name: organization.name,
        },
        accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Google sign-in/sign-up (users)
 * @route   POST /api/auth/google
 * @access  Public
 */
const googleAuth = async (req, res) => {
  try {
    const { credential, intent = "login" } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth is not configured on server",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.sub) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google identity payload",
      });
    }

    if (!payload.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Google email is not verified",
      });
    }

    const email = payload.email.toLowerCase().trim();
    let user = await User.findOne({ email }).select("+refreshToken");

    if (!user && intent === "login") {
      return res.status(404).json({
        success: false,
        message: "No account found. Please sign up first using Google.",
      });
    }

    if (!user && intent === "signup") {
      user = await User.create({
        name: payload.name || "Google User",
        email,
        password: crypto.randomBytes(24).toString("hex"),
        role: "user",
        authProvider: "google",
        googleId: payload.sub,
        isEmailVerified: true,
        isOnboarded: false,
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Unable to process Google authentication",
      });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message:
          "Google auth is enabled for user accounts only. Use regular login for staff/admin.",
      });
    }

    user.authProvider = "google";
    if (!user.googleId) {
      user.googleId = payload.sub;
    }
    user.isEmailVerified = true;

    const authPayload = await setAuthCookiesAndResponse(
      res,
      user,
      "Google authentication successful",
    );

    authPayload.data.onboardingRequired = user.isOnboarded === false;
    if (user.isOnboarded === false) {
      authPayload.message =
        "Google authentication successful. Complete onboarding.";
    }

    return res.status(200).json(authPayload);
  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

/**
 * @desc    Complete Google onboarding for new users
 * @route   POST /api/auth/google/onboarding
 * @access  Private/User
 */
const completeGoogleOnboarding = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      department,
      orgCode,
      organizationType,
      userIdentifier,
      preferredPaymentMode,
      preferredPaymentTimeSlot,
    } = req.body;

    if (!orgCode) {
      return res.status(400).json({
        success: false,
        message: "Organization code is required",
      });
    }

    const user = await User.findById(req.user.id).select("+refreshToken");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Only user accounts can complete this onboarding",
      });
    }

    const organization = await Organization.findOne({
      code: String(orgCode).toUpperCase().trim(),
      status: "active",
    });

    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive organization code",
      });
    }

    user.name = fullName?.trim() || user.name;
    user.phone = phone?.trim() || user.phone;
    user.department = department?.trim() || user.department;
    user.organization = organization._id;
    user.isOnboarded = true;
    user.onboardingCompletedAt = new Date();
    user.onboardingProfile = {
      organizationType: organizationType || null,
      userIdentifier: userIdentifier?.trim() || null,
      preferredPaymentMode: preferredPaymentMode || "either",
      preferredPaymentTimeSlot: preferredPaymentTimeSlot || "anytime",
    };

    const authPayload = await setAuthCookiesAndResponse(
      res,
      user,
      "Onboarding completed successfully",
    );

    return res.status(200).json(authPayload);
  } catch (error) {
    console.error("completeGoogleOnboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete onboarding",
    });
  }
};

// Deprecated: old register function replaced by registerUser
// const register = async (req, res) => { ... }

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+password +refreshToken")
      .populate("organization", "name code logo");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil(
        (user.lockUntil - Date.now()) / 60000,
      );
      return res.status(423).json({
        success: false,
        message: `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`,
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incrementLoginAttempts();

      const attemptsRemaining = 5 - (user.loginAttempts + 1);

      return res.status(401).json({
        success: false,
        message:
          attemptsRemaining > 0
            ? `Invalid email or password. ${attemptsRemaining} attempts remaining.`
            : "Account locked due to too many failed attempts.",
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token to database
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

    // Send response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toPublicProfile(),
        accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public (with refresh token)
 */
const refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie or body
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not provided",
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      // Clear invalid cookie
      res.clearCookie("refreshToken");

      return res.status(401).json({
        success: false,
        message: error.message || "Invalid refresh token",
      });
    }

    // Find user and verify stored refresh token
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user) {
      res.clearCookie("refreshToken");
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify the refresh token matches the one stored in database
    if (user.refreshToken !== token) {
      // Possible token reuse attack - invalidate all tokens
      user.refreshToken = null;
      await user.save();
      res.clearCookie("refreshToken");

      return res.status(401).json({
        success: false,
        message: "Invalid refresh token. Please login again.",
      });
    }

    // Check if account is still active
    if (!user.isActive) {
      res.clearCookie("refreshToken");
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokenPair(user);

    // Update refresh token in database (token rotation)
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new refresh token in cookie
    res.cookie("refreshToken", newRefreshToken, getCookieOptions("refresh"));

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.clearCookie("refreshToken");
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Get user from request (set by auth middleware)
    const userId = req.user?.id;

    if (userId) {
      // Clear refresh token in database
      await User.findByIdAndUpdate(userId, {
        $unset: { refreshToken: 1 },
      });
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Still clear cookie even if database update fails
    res.clearCookie("refreshToken");
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  }
};

/**
 * @desc    Forgot password - send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email address",
      });
    }

    const user = await User.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(user, resetUrl, req.ip);

    console.log("Password reset URL:", resetUrl); // Development only

    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
      // Only include token in development
      ...(process.env.NODE_ENV === "development" && { resetToken, resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    // Clear reset token if email fails
    if (req.body.email) {
      const user = await User.findByEmail(req.body.email);
      if (user) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
      }
    }

    res.status(500).json({
      success: false,
      message: "Error sending password reset email",
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Validate passwords
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide password and confirmation",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find user by reset token
    const user = await User.findByResetToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Generate new tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

    // Send notification
    await Notification.create({
      recipient: user._id,
      type: "account_update",
      title: "Password Changed",
      message: "Your password has been successfully reset.",
      priority: "high",
    });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      data: {
        user: user.toPublicProfile(),
        accessToken,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
    });
  }
};

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findByVerificationToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying email",
    });
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    await sendVerificationEmail(user, verificationUrl);

    res.status(200).json({
      success: true,
      message: "Verification email sent",
      ...(process.env.NODE_ENV === "development" && { verificationUrl }),
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending verification email",
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "specializations",
      "name color",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get additional stats based on role
    let additionalData = {};

    if (user.role === "user") {
      const Complaint = require("../models/Complaint");
      const stats = await Complaint.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      additionalData.complaintStats = stats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
    } else if (user.role === "staff") {
      additionalData = await User.getStaffStats(user._id);
    }

    // Get unread notification count
    const unreadNotifications = await Notification.getUnreadCount(user._id);

    res.status(200).json({
      success: true,
      data: {
        user:
          user.role === "staff"
            ? user.toStaffProfile()
            : user.toPublicProfile(),
        ...additionalData,
        unreadNotifications,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide current password, new password, and confirmation",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is same as current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new tokens (invalidate old sessions)
    const { accessToken, refreshToken } = generateTokenPair(user);
    user.refreshToken = refreshToken;
    await user.save();

    // Set new cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

    // Send notification
    await Notification.create({
      recipient: user._id,
      type: "account_update",
      title: "Password Changed",
      message: "Your password has been successfully changed.",
      priority: "high",
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        accessToken,
      },
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
    });
  }
};

/**
 * @desc    Register staff member (Admin only)
 * @route   POST /api/auth/register-staff
 * @access  Private/Admin
 */
const registerStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      department,
      designation,
      specializations,
      maxAssignedComplaints,
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create staff user
    const staff = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      department: department?.trim(),
      designation: designation?.trim(),
      role: "staff",
      organization: req.user.organization, // Link to admin's organization
      specializations: specializations || [],
      maxAssignedComplaints: maxAssignedComplaints || 10,
      isEmailVerified: true, // Admin-created accounts are pre-verified
    });

    // Send welcome notification
    await Notification.create({
      recipient: staff._id,
      type: "system_announcement",
      title: "Welcome to Complaint Resolution System",
      message: `Hello ${staff.name}! You have been registered as a staff member. You can now handle assigned complaints.`,
      priority: "normal",
    });

    res.status(201).json({
      success: true,
      message: "Staff member registered successfully",
      data: staff.toStaffProfile(),
    });
  } catch (error) {
    console.error("Register staff error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error registering staff member",
    });
  }
};

/**
 * @desc    Register admin (Super admin or initial setup)
 * @route   POST /api/auth/register-admin
 * @access  Private/Admin or Public (first admin only)
 */
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, department, setupKey, organization } =
      req.body;

    // Check if this is initial setup (no admins exist)
    const adminCount = await User.countDocuments({
      role: { $in: ["admin", "org_admin", "super_admin"] },
    });

    if (adminCount > 0) {
      // Require admin authentication for subsequent admin creation
      if (
        !req.user ||
        !["admin", "org_admin", "super_admin"].includes(req.user.role)
      ) {
        return res.status(403).json({
          success: false,
          message: "Only existing admins can create new admin accounts",
        });
      }
    } else {
      // First admin - require setup key
      if (setupKey !== process.env.ADMIN_SETUP_KEY) {
        return res.status(403).json({
          success: false,
          message: "Invalid setup key",
        });
      }
    }

    const resolvedOrganization =
      organization || req.user?.organization || undefined;
    const targetRole = resolvedOrganization ? "org_admin" : "super_admin";

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create admin user
    const admin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      department: department?.trim() || "Administration",
      role: targetRole,
      organization: resolvedOrganization,
      isEmailVerified: true,
    });

    // Generate tokens for immediate login
    const { accessToken, refreshToken } = generateTokenPair(admin);
    admin.refreshToken = refreshToken;
    await admin.save();

    res.cookie("refreshToken", refreshToken, getCookieOptions("refresh"));

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: {
        user: admin.toPublicProfile(),
        accessToken,
      },
    });
  } catch (error) {
    console.error("Register admin error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error registering admin",
    });
  }
};

module.exports = {
  register: registerUser,
  registerOrganization,
  login,
  googleAuth,
  completeGoogleOnboarding,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getMe,
  changePassword,
  registerStaff,
  registerAdmin,
};
