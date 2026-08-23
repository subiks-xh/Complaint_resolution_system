/**
 * Authentication Routes
 *
 * Handles all authentication-related endpoints:
 * - User registration and login
 * - Token refresh and logout
 * - Password reset flow
 * - Email verification
 * - Staff/Admin registration
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  register, // This is now registerUser
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
} = require("../controllers/authController");

// Middleware
const {
  protect,
  sensitiveOperationLimiter,
} = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const { authValidation } = require("../middleware/validateRequest");

/**
 * @route   POST /api/auth/register-org
 * @desc    Register a new Organization and Admin
 * @access  Public
 */
router.post("/register-org", sensitiveOperationLimiter, registerOrganization);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Join Org)
 * @access  Public
 */
router.post(
  "/register",
  sensitiveOperationLimiter,
  authValidation.register,
  register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get tokens
 * @access  Public
 */
router.post("/login", sensitiveOperationLimiter, authValidation.login, login);

/**
 * @route   POST /api/auth/google
 * @desc    Google sign-in/sign-up for user accounts
 * @access  Public
 */
router.post("/google", sensitiveOperationLimiter, googleAuth);

/**
 * @route   POST /api/auth/google/onboarding
 * @desc    Complete onboarding after first Google signup
 * @access  Private/User
 */
router.post("/google/onboarding", protect, completeGoogleOnboarding);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public (with refresh token)
 */
router.post("/refresh-token", refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post("/logout", protect, logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  "/forgot-password",
  sensitiveOperationLimiter,
  authValidation.forgotPassword,
  forgotPassword,
);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post(
  "/reset-password/:token",
  sensitiveOperationLimiter,
  authValidation.resetPassword,
  resetPassword,
);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email address
 * @access  Public
 */
router.get("/verify-email/:token", verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post(
  "/resend-verification",
  protect,
  sensitiveOperationLimiter,
  resendVerificationEmail,
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get("/me", protect, getMe);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  "/change-password",
  protect,
  sensitiveOperationLimiter,
  authValidation.changePassword,
  changePassword,
);

/**
 * @route   POST /api/auth/register-staff
 * @desc    Register a new staff member (Admin only)
 * @access  Private/Admin
 */
router.post(
  "/register-staff",
  protect,
  adminOnly,
  authValidation.registerStaff,
  registerStaff,
);

/**
 * @route   POST /api/auth/register-admin
 * @desc    Register a new admin (First admin or existing admin only)
 * @access  Private/Admin or Public (first admin only)
 */
router.post("/register-admin", sensitiveOperationLimiter, registerAdmin);

/**
 * @route   GET /api/auth/check
 * @desc    Check if user is authenticated (for frontend)
 * @access  Private
 */
router.get("/check", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated",
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
      },
    },
  });
});

/**
 * @route   GET /api/auth/validate-token
 * @desc    Validate access token
 * @access  Private
 */
router.get("/validate-token", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    data: {
      userId: req.user.id,
      role: req.user.role,
      expiresIn: req.tokenExp, // If attached by middleware
    },
  });
});

module.exports = router;
