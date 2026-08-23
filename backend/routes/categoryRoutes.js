/**
 * Category Routes
 *
 * Handles all category-related endpoints:
 * - View categories (public for complaint forms)
 * - Category management (admin)
 * - Category statistics
 * - SLA configuration
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
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
} = require("../controllers/categoryController");

// Middleware
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const {
  categoryValidation,
  commonValidation,
} = require("../middleware/validateRequest");

/**
 * ================================
 * Public Category Routes
 * ================================
 */

/**
 * @route   GET /api/categories
 * @desc    Get all categories (for complaint forms)
 * @access  Public
 */
router.get("/", optionalAuth, getAllCategories);

/**
 * @route   GET /api/categories/tree
 * @desc    Get categories in tree structure
 * @access  Public
 */
router.get("/tree", getCategoryTree);

/**
 * @route   POST /api/categories/suggest
 * @desc    Suggest category based on complaint text
 * @access  Public
 */
router.post("/suggest", categoryValidation.suggest, suggestCategory);

/**
 * @route   GET /api/categories/:identifier
 * @desc    Get single category by ID or slug
 * @access  Public
 */
router.get("/:identifier", categoryValidation.getById, getCategory);

/**
 * ================================
 * Admin Category Management Routes
 * ================================
 */

// Apply protection to all routes below
router.use(protect);
router.use(adminOnly);

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private/Admin
 */
router.post("/", categoryValidation.create, createCategory);

/**
 * @route   PUT /api/categories/reorder
 * @desc    Reorder categories
 * @access  Private/Admin
 */
router.put("/reorder", reorderCategories);

/**
 * @route   POST /api/categories/seed
 * @desc    Seed default categories
 * @access  Private/Admin
 */
router.post("/seed", seedCategories);

/**
 * @route   GET /api/categories/stats/all
 * @desc    Get all categories with statistics
 * @access  Private/Admin
 */
router.get("/stats/all", getAllCategoryStats);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Private/Admin
 */
router.put("/:id", categoryValidation.update, updateCategory);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Private/Admin
 */
router.delete("/:id", commonValidation.objectIdParam("id"), deleteCategory);

/**
 * @route   PUT /api/categories/:id/toggle-status
 * @desc    Toggle category active status
 * @access  Private/Admin
 */
router.put(
  "/:id/toggle-status",
  commonValidation.objectIdParam("id"),
  toggleCategoryStatus,
);

/**
 * @route   GET /api/categories/:id/stats
 * @desc    Get category statistics
 * @access  Private/Admin
 */
router.get(
  "/:id/stats",
  commonValidation.objectIdParam("id"),
  commonValidation.dateRange,
  getCategoryStats,
);

/**
 * @route   PUT /api/categories/:id/sla
 * @desc    Update category SLA configuration
 * @access  Private/Admin
 */
router.put("/:id/sla", commonValidation.objectIdParam("id"), updateCategorySLA);

/**
 * @route   PUT /api/categories/:id/keywords
 * @desc    Update category keywords
 * @access  Private/Admin
 */
router.put("/:id/keywords", categoryValidation.updateKeywords, updateKeywords);

/**
 * @route   PUT /api/categories/:id/staff
 * @desc    Assign staff to category
 * @access  Private/Admin
 */
router.put(
  "/:id/staff",
  commonValidation.objectIdParam("id"),
  assignStaffToCategory,
);

module.exports = router;
