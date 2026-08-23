/**
 * Email Utility
 *
 * Provides email sending functionality:
 * - Email configuration
 * - Template-based emails
 * - Transactional emails (password reset, verification, etc.)
 * - Notification emails
 */

const nodemailer = require("nodemailer");

/**
 * Email Configuration
 */
const emailConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || "Complaint Resolution System",
    email: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER,
  },
};

/**
 * Check if email is configured
 */
const isEmailConfigured = () => {
  return !!(emailConfig.auth.user && emailConfig.auth.pass);
};

/**
 * Create email transporter
 */
let transporter = null;

const getTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn(
      "⚠️  Email is not configured. Set SMTP_USER and SMTP_PASS environment variables.",
    );
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
      // Add these for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    });
  }

  return transporter;
};

/**
 * Verify email connection
 *
 * @returns {Promise<boolean>} Whether connection is successful
 */
const verifyConnection = async () => {
  const transport = getTransporter();

  if (!transport) {
    return false;
  }

  try {
    await transport.verify();
    console.log("✅ Email server connection verified");
    return true;
  } catch (error) {
    console.error("❌ Email server connection failed:", error.message);
    return false;
  }
};

/**
 * Email Templates
 */
const templates = {
  /**
   * Password Reset Email
   */
  passwordReset: (data) => ({
    subject: "Password Reset Request - Complaint Resolution System",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #5a6fd6; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .code { background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link in your browser:</p>
            <div class="code">${data.resetUrl}</div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
            
            <p>For security reasons, this request was received from:</p>
            <ul>
              <li>IP Address: ${data.ipAddress || "Unknown"}</li>
              <li>Time: ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name},
      
      We received a request to reset your password.
      
      Click the following link to reset your password:
      ${data.resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this reset, please ignore this email.
      
      - Complaint Resolution System
    `,
  }),

  /**
   * Email Verification
   */
  emailVerification: (data) => ({
    subject: "Verify Your Email - Complaint Resolution System",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #11998e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .code { background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Welcome to Complaint Resolution System! Please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${data.verificationUrl}" class="button">Verify Email</a>
            </div>
            
            <p>Or copy and paste this link in your browser:</p>
            <div class="code">${data.verificationUrl}</div>
            
            <p>This link will expire in <strong>24 hours</strong>.</p>
            
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name},
      
      Welcome to Complaint Resolution System!
      
      Please verify your email by clicking the following link:
      ${data.verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, please ignore this email.
      
      - Complaint Resolution System
    `,
  }),

  /**
   * Welcome Email
   */
  welcome: (data) => ({
    subject: "Welcome to Complaint Resolution System!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .feature { display: flex; align-items: center; margin: 15px 0; }
          .feature-icon { font-size: 24px; margin-right: 15px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Welcome to Complaint Resolution System! Your account has been successfully created.</p>
            
            <h3>What you can do:</h3>
            <div class="feature">
              <span class="feature-icon">📝</span>
              <span>Submit complaints and track their status</span>
            </div>
            <div class="feature">
              <span class="feature-icon">🔔</span>
              <span>Receive real-time updates on your complaints</span>
            </div>
            <div class="feature">
              <span class="feature-icon">⭐</span>
              <span>Provide feedback on resolved issues</span>
            </div>
            
            <div style="text-align: center;">
              <a href="${data.loginUrl}" class="button">Get Started</a>
            </div>
            
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name},
      
      Welcome to Complaint Resolution System! Your account has been successfully created.
      
      What you can do:
      - Submit complaints and track their status
      - Receive real-time updates on your complaints
      - Provide feedback on resolved issues
      
      Get started at: ${data.loginUrl}
      
      - Complaint Resolution System
    `,
  }),

  /**
   * Complaint Status Update
   */
  complaintStatusUpdate: (data) => ({
    subject: `Complaint ${data.complaintId} - Status Update: ${data.status}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complaint Status Update</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .status { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
          .status-resolved { background: #d4edda; color: #155724; }
          .status-in-progress { background: #cce5ff; color: #004085; }
          .status-escalated { background: #f8d7da; color: #721c24; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Complaint Update</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Your complaint has been updated:</p>
            
            <div class="info-box">
              <p><strong>Complaint ID:</strong> ${data.complaintId}</p>
              <p><strong>Title:</strong> ${data.title}</p>
              <p><strong>New Status:</strong> 
                <span class="status status-${data.status.toLowerCase().replace(" ", "-")}">${data.status}</span>
              </p>
              ${data.remarks ? `<p><strong>Remarks:</strong> ${data.remarks}</p>` : ""}
            </div>
            
            <div style="text-align: center;">
              <a href="${data.complaintUrl}" class="button">View Complaint</a>
            </div>
            
            ${
              data.status === "Resolved"
                ? `
              <p>If you're satisfied with the resolution, please take a moment to provide feedback.</p>
            `
                : ""
            }
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name},
      
      Your complaint has been updated:
      
      Complaint ID: ${data.complaintId}
      Title: ${data.title}
      New Status: ${data.status}
      ${data.remarks ? `Remarks: ${data.remarks}` : ""}
      
      View your complaint at: ${data.complaintUrl}
      
      - Complaint Resolution System
    `,
  }),

  /**
   * New Assignment Notification (for staff)
   */
  newAssignment: (data) => ({
    subject: `New Complaint Assigned: ${data.complaintId}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Assignment</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #f5576c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .priority { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: bold; }
          .priority-high, .priority-critical { background: #f8d7da; color: #721c24; }
          .priority-medium { background: #fff3cd; color: #856404; }
          .priority-low { background: #d4edda; color: #155724; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .deadline { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📌 New Assignment</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.staffName}</strong>,</p>
            <p>A new complaint has been assigned to you:</p>
            
            <div class="info-box">
              <p><strong>Complaint ID:</strong> ${data.complaintId}</p>
              <p><strong>Title:</strong> ${data.title}</p>
              <p><strong>Category:</strong> ${data.category}</p>
              <p><strong>Priority:</strong> 
                <span class="priority priority-${data.priority.toLowerCase()}">${data.priority}</span>
              </p>
              <p><strong>Submitted by:</strong> ${data.userName}</p>
            </div>
            
            ${
              data.deadline
                ? `
              <div class="deadline">
                <strong>⏰ Deadline:</strong> ${data.deadline}
              </div>
            `
                : ""
            }
            
            <div style="text-align: center;">
              <a href="${data.complaintUrl}" class="button">View & Start Working</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.staffName},
      
      A new complaint has been assigned to you:
      
      Complaint ID: ${data.complaintId}
      Title: ${data.title}
      Category: ${data.category}
      Priority: ${data.priority}
      Submitted by: ${data.userName}
      ${data.deadline ? `Deadline: ${data.deadline}` : ""}
      
      View the complaint at: ${data.complaintUrl}
      
      - Complaint Resolution System
    `,
  }),

  /**
   * Escalation Alert
   */
  escalationAlert: (data) => ({
    subject: `⚠️ ESCALATION: Complaint ${data.complaintId} Requires Attention`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Escalation Alert</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #eb3349; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .alert-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Escalation Alert</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>This complaint has been escalated and requires immediate attention!</strong>
            </div>
            
            <p>Hello <strong>${data.recipientName}</strong>,</p>
            <p>The following complaint has been escalated:</p>
            
            <div class="info-box">
              <p><strong>Complaint ID:</strong> ${data.complaintId}</p>
              <p><strong>Title:</strong> ${data.title}</p>
              <p><strong>Escalation Reason:</strong> ${data.reason}</p>
              <p><strong>Escalation Level:</strong> ${data.escalationLevel}</p>
              <p><strong>Original Deadline:</strong> ${data.deadline}</p>
              ${data.previousAssignee ? `<p><strong>Previously Assigned To:</strong> ${data.previousAssignee}</p>` : ""}
            </div>
            
            <div style="text-align: center;">
              <a href="${data.complaintUrl}" class="button">Take Action Now</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated email from Complaint Resolution System.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ⚠️ ESCALATION ALERT
      
      Hello ${data.recipientName},
      
      The following complaint has been escalated and requires immediate attention:
      
      Complaint ID: ${data.complaintId}
      Title: ${data.title}
      Escalation Reason: ${data.reason}
      Escalation Level: ${data.escalationLevel}
      Original Deadline: ${data.deadline}
      ${data.previousAssignee ? `Previously Assigned To: ${data.previousAssignee}` : ""}
      
      Take action now: ${data.complaintUrl}
      
      - Complaint Resolution System
    `,
  }),
};

/**
 * Send Email
 *
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content
 * @param {string} options.template - Template name (optional)
 * @param {Object} options.data - Template data (optional)
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async (options) => {
  try {
    const transport = getTransporter();

    if (!transport) {
      console.log("📧 Email not configured. Would have sent:", {
        to: options.to,
        subject: options.subject || options.template,
      });

      // Return mock success in development
      if (process.env.NODE_ENV === "development") {
        return {
          success: true,
          messageId: "mock-" + Date.now(),
          mock: true,
        };
      }

      throw new Error("Email service not configured");
    }

    // Get template if specified
    let emailContent = {
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (options.template && templates[options.template]) {
      emailContent = templates[options.template](options.data || {});
    }

    // Build email message
    const message = {
      from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
      to: options.to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      // Optional attachments
      attachments: options.attachments,
    };

    // Send email
    const info = await transport.sendMail(message);

    console.log(`✅ Email sent successfully to ${options.to}:`, info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error("❌ Error sending email:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Template Email
 *
 * @param {string} to - Recipient email
 * @param {string} templateName - Template name
 * @param {Object} data - Template data
 * @returns {Promise<Object>} Send result
 */
const sendTemplateEmail = async (to, templateName, data) => {
  if (!templates[templateName]) {
    throw new Error(`Email template '${templateName}' not found`);
  }

  return sendEmail({
    to,
    template: templateName,
    data,
  });
};

/**
 * Send Bulk Emails
 *
 * @param {Array<Object>} emails - Array of email options
 * @returns {Promise<Array>} Results
 */
const sendBulkEmails = async (emails) => {
  const results = [];

  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ to: email.to, ...result });
    } catch (error) {
      results.push({ to: email.to, success: false, error: error.message });
    }

    // Small delay between emails to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
};

/**
 * Convenience functions for common emails
 */

const sendPasswordResetEmail = async (user, resetUrl, ipAddress) => {
  return sendTemplateEmail(user.email, "passwordReset", {
    name: user.name,
    resetUrl,
    ipAddress,
  });
};

const sendVerificationEmail = async (user, verificationUrl) => {
  return sendTemplateEmail(user.email, "emailVerification", {
    name: user.name,
    verificationUrl,
  });
};

const sendWelcomeEmail = async (user, loginUrl) => {
  return sendTemplateEmail(user.email, "welcome", {
    name: user.name,
    loginUrl,
  });
};

const sendComplaintStatusEmail = async (user, complaint, status, remarks) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  return sendTemplateEmail(user.email, "complaintStatusUpdate", {
    name: user.name,
    complaintId: complaint.complaintId,
    title: complaint.title,
    status,
    remarks,
    complaintUrl: `${frontendUrl}/complaints/${complaint._id}`,
  });
};

const sendNewAssignmentEmail = async (staff, complaint, deadline) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  return sendTemplateEmail(staff.email, "newAssignment", {
    staffName: staff.name,
    complaintId: complaint.complaintId,
    title: complaint.title,
    category: complaint.category?.name || "General",
    priority: complaint.priority,
    userName: complaint.user?.name || "User",
    deadline: deadline ? new Date(deadline).toLocaleString() : null,
    complaintUrl: `${frontendUrl}/staff/complaints/${complaint._id}`,
  });
};

const sendEscalationAlertEmail = async (
  recipient,
  complaint,
  reason,
  escalationLevel,
) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  return sendTemplateEmail(recipient.email, "escalationAlert", {
    recipientName: recipient.name,
    complaintId: complaint.complaintId,
    title: complaint.title,
    reason,
    escalationLevel,
    deadline: complaint.resolutionDeadline
      ? new Date(complaint.resolutionDeadline).toLocaleString()
      : "Not set",
    previousAssignee: complaint.assignedTo?.name,
    complaintUrl: `${frontendUrl}/admin/complaints/${complaint._id}`,
  });
};

module.exports = {
  // Configuration
  emailConfig,
  isEmailConfigured,
  verifyConnection,

  // Core functions
  sendEmail,
  sendTemplateEmail,
  sendBulkEmails,

  // Convenience functions
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendComplaintStatusEmail,
  sendNewAssignmentEmail,
  sendEscalationAlertEmail,

  // Templates (for customization)
  templates,
};
