const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Assignment Rules Management
router.post('/assignment-rules', assignmentController.createAssignmentRule);
router.get('/assignment-rules', assignmentController.getAssignmentRules);
router.put('/assignment-rules/:id', assignmentController.updateAssignmentRule);
router.delete('/assignment-rules/:id', assignmentController.deleteAssignmentRule);

// Enhanced Assignment Endpoint
router.post('/complaints/:complaintId/assign', assignmentController.assignComplaintWithRules);

// SLA and Analytics
router.get('/sla-info', assignmentController.getSLAInfo);
router.get('/assignment-analytics', assignmentController.getAssignmentAnalytics);

module.exports = router;