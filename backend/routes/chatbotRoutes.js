const express = require("express");
const router = express.Router();

const { sendChatbotMessage } = require("../controllers/chatbotController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.post("/message", sendChatbotMessage);

module.exports = router;
