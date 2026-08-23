const express = require("express");
const router = express.Router();

const {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  applyTemplateToComplaint,
} = require("../controllers/templateController");

const { protect } = require("../middleware/authMiddleware");
const { restrictTo } = require("../middleware/roleMiddleware");

router.use(protect);
router.use(restrictTo("staff", "admin", "org_admin", "super_admin"));

router.post("/", createTemplate);
router.get("/", listTemplates);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);
router.post("/:templateId/apply/:complaintId", applyTemplateToComplaint);

module.exports = router;
