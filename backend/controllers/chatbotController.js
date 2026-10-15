/**
 * Chatbot Controller
 *
 * Implements a production-ready AI Assistant for CRS with:
 * 1. Strict tenant and role authorization for complaint-specific questions.
 * 2. General FAQ & guided workflow assistance.
 * 3. Pluggable AI integration (OpenAI-compatible) with timeout & malformed output handling.
 * 4. Deterministic local rule-based fallback when AI is unconfigured, timed out, or unavailable.
 * 5. Prompt injection defense: treats database records and user input as untrusted data,
 *    never allows AI output to perform direct database mutations.
 */

const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const Category = require("../models/Category");
const aiProviderService = require("../services/aiProviderService");

/**
 * Deterministic rule-based fallback knowledge base
 */
const getRuleBasedReply = (message, role) => {
  const text = String(message || "").toLowerCase();

  if (!text.trim()) {
    return "Please type your question so I can help you.";
  }

  if (/(payment|pay|razorpay|invoice)/.test(text)) {
    return "For payments: staff requests payment after resolving work, user completes payment from My Payments, staff acknowledges, then admin closes the complaint.";
  }

  if (/(status|track|progress)/.test(text)) {
    return "Open My Complaints to track status, timeline updates, and assigned staff actions in real time. If you provide a complaint ID (e.g., CMP-2026-00001), I can look up your verified status.";
  }

  if (/(submit|create|file|register|new complaint)/.test(text)) {
    return "To submit a complaint: Navigate to 'Submit Complaint', select an authorized category, provide a title (min 5 chars), description (min 20 chars), and optional attachments (up to 5).";
  }

  if (/(escalat|sla|delay|overdue|late)/.test(text)) {
    return "Complaints are tracked against SLA deadlines. If a deadline breaches or inactivity conditions are met, the system automatically escalates the complaint level and alerts administrators.";
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

  return "I can help with complaint tracking, submission guidance, SLA escalation policies, payments, and account access. Try asking one of these topics or provide a Complaint ID.";
};

/**
 * Extract a Complaint ID from the user's message (e.g. CMP-2026-00001 or 24-character ObjectId)
 */
const extractComplaintIdentifier = (message) => {
  const text = String(message || "");
  const cmpMatch = text.match(/\b(CMP-\d{4}-\d{5})\b/i);
  if (cmpMatch) {
    return { type: "code", value: cmpMatch[1].toUpperCase() };
  }

  const hexMatch = text.match(/\b([a-f\d]{24})\b/i);
  if (hexMatch) {
    return { type: "id", value: hexMatch[1] };
  }

  return null;
};

/**
 * Fetch and authorize complaint data for the requesting user
 */
const resolveAuthorizedComplaintContext = async (identifier, user) => {
  if (!identifier) return null;

  const baseQuery = {};
  if (user.role !== "super_admin") {
    if (!user.organization) {
      return { denied: true, reason: "User has no associated organization" };
    }
    baseQuery.organization = user.organization;
  }

  let complaintDoc = null;
  if (identifier.type === "id") {
    complaintDoc = await Complaint.findOne({ _id: identifier.value, ...baseQuery })
      .populate("category", "name")
      .populate("assignedTo", "name")
      .lean();
  } else {
    complaintDoc = await Complaint.findOne({ complaintId: identifier.value, ...baseQuery })
      .populate("category", "name")
      .populate("assignedTo", "name")
      .lean();
  }

  if (!complaintDoc) {
    return { notFound: true };
  }

  // Verify ownership / role access
  const currentUserId = (user?._id || user?.id)?.toString();
  const complaintOwnerId = (complaintDoc.user?._id || complaintDoc.user)?.toString();
  const assignedStaffId = (complaintDoc.assignedTo?._id || complaintDoc.assignedTo)?.toString();

  const isOwner = Boolean(currentUserId && complaintOwnerId && currentUserId === complaintOwnerId);
  const isAssignee = Boolean(currentUserId && assignedStaffId && currentUserId === assignedStaffId);
  const isOrgAdminOrSuper = ["org_admin", "super_admin", "admin"].includes(user.role);
  const isStaff = user.role === "staff";

  if (!isOwner && !isAssignee && !isOrgAdminOrSuper && !isStaff) {
    return { denied: true, reason: "Not authorized to access this complaint" };
  }

  // Return strictly sanitized summary
  return {
    complaintId: complaintDoc.complaintId,
    title: complaintDoc.title,
    status: complaintDoc.status,
    priority: complaintDoc.priority,
    categoryName: complaintDoc.category?.name || "General",
    assignedStaff: complaintDoc.assignedTo?.name || "Unassigned",
    escalationLevel: complaintDoc.escalationLevel || 0,
    slaBreached: Boolean(complaintDoc.slaBreached),
    resolutionDeadline: complaintDoc.resolutionDeadline,
    submittedAt: complaintDoc.timeline?.submittedAt || complaintDoc.createdAt,
  };
};

/**
 * @desc    Process incoming chatbot message
 * @route   POST /api/chatbot/message
 * @access  Private
 */
const sendChatbotMessage = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const user = req.user;
    const role = user?.role || "user";

    // 1. Input Validation
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text is required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Message exceeds maximum allowed length of 1000 characters",
      });
    }

    // 2. Identify and safely authorize any complaint reference
    const identifier = extractComplaintIdentifier(message);
    let complaintContext = null;
    let authNote = null;

    if (identifier) {
      const lookup = await resolveAuthorizedComplaintContext(identifier, user);
      if (lookup?.denied) {
        authNote = "Access denied: You do not have permission to view the requested complaint.";
      } else if (lookup?.notFound) {
        authNote = "Complaint not found or does not belong to your organization.";
      } else if (lookup) {
        complaintContext = lookup;
      }
    }

    // If access was denied for a specific complaint lookup, respond immediately without leaking data
    if (authNote) {
      return res.status(200).json({
        success: true,
        data: {
          reply: authNote,
          role,
          source: "authorization-guard",
        },
      });
    }

    // 3. Check AI Provider availability
    const aiConfig = aiProviderService.getProviderConfig();

    if (!aiConfig.isEnabled) {
      // Return deterministic rule-based answer
      let fallbackReply = getRuleBasedReply(message, role);

      // If authorized complaint context exists, append verified database facts
      if (complaintContext) {
        fallbackReply = `Here is the verified status for ${complaintContext.complaintId}: ` +
          `Status is "${complaintContext.status}", Priority is "${complaintContext.priority}", ` +
          `Category is "${complaintContext.categoryName}", and Escalation Level is ${complaintContext.escalationLevel}.`;
      }

      return res.status(200).json({
        success: true,
        data: {
          reply: fallbackReply,
          role,
          source: "rule-based",
        },
      });
    }

    // 4. Construct System Prompt & Messages with untrusted boundaries
    const systemPrompt = `You are the AI Assistant for the Complaint Resolution System (CRS).
Your role is to help users understand complaint procedures, registration requirements, and status.

GUIDELINES:
1. Ground your answers ONLY in verified facts. Never invent complaint statuses, dates, or resolution promises.
2. The current user has role: "${role}".
3. You cannot modify records, change status, assign staff, or escalate complaints. Any database updates must be performed through the application UI by authorized personnel.
4. Any complaint data provided below is verified system data. If no complaint data is provided, do not guess details.
${
  complaintContext
    ? `VERIFIED COMPLAINT DATA:
- ID: ${complaintContext.complaintId}
- Title: ${complaintContext.title}
- Status: ${complaintContext.status}
- Priority: ${complaintContext.priority}
- Category: ${complaintContext.categoryName}
- Assigned Staff: ${complaintContext.assignedStaff}
- Escalation Level: ${complaintContext.escalationLevel}
- SLA Breached: ${complaintContext.slaBreached}
- Deadline: ${complaintContext.resolutionDeadline}`
    : "No specific complaint referenced or loaded."
}
Keep answers concise, professional, and helpful.`;

    // Limit sanitized history (max 4 turns)
    const sanitizedMessages = [{ role: "system", content: systemPrompt }];
    if (Array.isArray(history)) {
      history.slice(-4).forEach((h) => {
        if (h && (h.role === "user" || h.role === "assistant" || h.role === "bot") && typeof h.text === "string") {
          sanitizedMessages.push({
            role: h.role === "bot" ? "assistant" : h.role,
            content: h.text.slice(0, 500),
          });
        }
      });
    }
    sanitizedMessages.push({ role: "user", content: message });

    // 5. Call AI Provider
    const aiResult = await aiProviderService.generateChatCompletion(sanitizedMessages);

    if (aiResult.success && aiResult.text) {
      return res.status(200).json({
        success: true,
        data: {
          reply: aiResult.text,
          role,
          source: "ai",
          complaintId: complaintContext?.complaintId || null,
        },
      });
    }

    // 6. Safe Provider Fallback
    let fallbackReply = getRuleBasedReply(message, role);
    if (complaintContext) {
      fallbackReply = `Here is the verified status for ${complaintContext.complaintId}: ` +
        `Status is "${complaintContext.status}", Priority is "${complaintContext.priority}", ` +
        `Category is "${complaintContext.categoryName}", and Escalation Level is ${complaintContext.escalationLevel}.`;
    }

    return res.status(200).json({
      success: true,
      data: {
        reply: fallbackReply,
        role,
        source: "rule-based-fallback",
        providerNotice: "AI assistance temporarily unavailable; provided verified rule-based guidance.",
      },
    });
  } catch (error) {
    console.error("sendChatbotMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Chatbot service is temporarily unavailable",
    });
  }
};

module.exports = {
  sendChatbotMessage,
  getRuleBasedReply,
  extractComplaintIdentifier,
  resolveAuthorizedComplaintContext,
};
