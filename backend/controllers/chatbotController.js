const getRuleBasedReply = (message, role) => {
  const text = String(message || "").toLowerCase();

  if (!text.trim()) {
    return "Please type your question so I can help you.";
  }

  if (/(payment|pay|razorpay|invoice)/.test(text)) {
    return "For payments: staff requests payment after resolving work, user completes payment from My Payments, staff acknowledges, then admin closes the complaint.";
  }

  if (/(status|track|progress)/.test(text)) {
    return "Open My Complaints to track status, timeline updates, and assigned staff actions in real time.";
  }

  if (/(attach|upload|file|document)/.test(text)) {
    return "You can upload up to 5 attachments while creating a complaint. Keep files clear and relevant for faster resolution.";
  }

  if (/(google|login|signup|onboarding)/.test(text)) {
    return "Google sign-in is supported for user accounts. First Google signup requires onboarding, and later logins go directly to dashboard.";
  }

  if (/(forgot|reset|password)/.test(text)) {
    return "Use the Forgot Password option on login. A reset link will be sent to your registered email.";
  }

  if (/(staff|assignment|assign)/.test(text)) {
    if (role === "staff") {
      return "Check Staff Dashboard for assigned complaints, start work sessions, and update status to resolved when work is complete.";
    }
    return "Complaints are assigned based on category, workload, and staff availability. You can view assignment updates in notifications.";
  }

  return "I can help with complaint status, payments, login/onboarding, password reset, and attachments. Try asking one of these topics.";
};

const sendChatbotMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const role = req.user?.role || "user";

    const reply = getRuleBasedReply(message, role);

    return res.status(200).json({
      success: true,
      data: {
        reply,
        role,
        source: "rule-based",
      },
    });
  } catch (error) {
    console.error("sendChatbotMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Chatbot is temporarily unavailable",
    });
  }
};

module.exports = {
  sendChatbotMessage,
};
