const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const Feedback = require("../../models/Feedback");
const { generateAccessToken } = require("../../config/jwt");

describe("Analytics and Feedback Tenant Isolation Integration Tests (Group 1)", () => {
  let orgA, orgB;
  let adminA, staffA1, userA1, userA2;
  let adminB, staffB1, userB1;
  let superAdmin;
  let adminAToken, staffA1Token, userA1Token, userA2Token;
  let adminBToken, staffB1Token, userB1Token;
  let superAdminToken;
  let categoryA, categoryB;
  let complaintA1, complaintA2, complaintB1;
  let feedbackA1, feedbackB1;

  const ALLOWED_TEST_DBS = [
    "complaint_system_assignment_test",
    "complaint_system_category_tenant_test",
    "complaint_system_complaint_tenant_test",
    "complaint_system_analytics_feedback_tenant_test",
    "complaint_system_test",
    "complaint_resolution_test",
  ];
  const TEST_DB_REGEX = /(?:_test|test_|-test|test-)$/i;

  const cleanupTestRecords = async () => {
    await Promise.all([
      Feedback.deleteMany({ comments: /Analytics & Feedback Test/ }),
      Complaint.deleteMany({ title: /Analytics & Feedback Test/ }),
      Category.deleteMany({ name: /Analytics Test Cat/ }),
      User.deleteMany({ email: /@analytics-feedback-tenant-test\.com$/ }),
      Organization.deleteMany({ code: /ANAFEED/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_analytics_feedback_tenant_test";

    // Strict safety check on URI
    const parsedPath = testDbUri
      .replace(/^mongodb(?:\+srv)?:\/\/[^\/]+\/?/, "")
      .split("?")[0];
    const uriDbName = parsedPath.trim();

    const isUriDbAllowed = ALLOWED_TEST_DBS.includes(uriDbName);
    const isUriDbNamedTest = TEST_DB_REGEX.test(uriDbName);

    if (!isUriDbAllowed || !isUriDbNamedTest) {
      throw new Error(
        `Safety Abort: TEST_MONGODB_URI database name "${uriDbName}" must be in ALLOWED_TEST_DBS and match the strict test naming suffix.`,
      );
    }

    if (mongoose.connection.readyState !== 0) {
      const currentDbName = mongoose.connection.name || "";
      const isCurrentDbSafe =
        ALLOWED_TEST_DBS.includes(currentDbName) &&
        TEST_DB_REGEX.test(currentDbName);
      if (!isCurrentDbSafe) {
        await mongoose.disconnect();
      }
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    const activeDbName = mongoose.connection.name || "";
    const isActiveDbSafe =
      ALLOWED_TEST_DBS.includes(activeDbName) &&
      TEST_DB_REGEX.test(activeDbName);

    if (!isActiveDbSafe) {
      await mongoose.disconnect();
      throw new Error(
        `Safety Abort: Active connected database "${activeDbName}" is not on the test database allowlist or does not match strict test naming rules.`,
      );
    }

    await cleanupTestRecords();

    // Create Organizations
    orgA = await Organization.create({
      name: "Analytics Test Org Alpha",
      code: "ANAFEED-A",
      email: "org-alpha@analytics-feedback-tenant-test.com",
    });

    orgB = await Organization.create({
      name: "Analytics Test Org Beta",
      code: "ANAFEED-B",
      email: "org-beta@analytics-feedback-tenant-test.com",
    });

    // Create Users for Org Alpha
    adminA = await User.create({
      name: "Admin Alpha",
      email: "admin-alpha@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    staffA1 = await User.create({
      name: "Staff Alpha 1",
      email: "staff-alpha1@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      department: "Support Alpha",
      isActive: true,
      isOnboarded: true,
    });

    userA1 = await User.create({
      name: "User Alpha 1",
      email: "user-alpha1@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    userA2 = await User.create({
      name: "User Alpha 2",
      email: "user-alpha2@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    // Create Users for Org Beta
    adminB = await User.create({
      name: "Admin Beta",
      email: "admin-beta@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    staffB1 = await User.create({
      name: "Staff Beta 1",
      email: "staff-beta1@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      department: "Support Beta",
      isActive: true,
      isOnboarded: true,
    });

    userB1 = await User.create({
      name: "User Beta 1",
      email: "user-beta1@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    // Super Admin
    superAdmin = await User.create({
      name: "Super Admin",
      email: "superadmin@analytics-feedback-tenant-test.com",
      password: "Password123!",
      role: "super_admin",
      organization: null,
      isActive: true,
      isOnboarded: true,
    });

    // Generate JWT Tokens
    adminAToken = generateAccessToken(adminA);
    staffA1Token = generateAccessToken(staffA1);
    userA1Token = generateAccessToken(userA1);
    userA2Token = generateAccessToken(userA2);

    adminBToken = generateAccessToken(adminB);
    staffB1Token = generateAccessToken(staffB1);
    userB1Token = generateAccessToken(userB1);

    superAdminToken = generateAccessToken(superAdmin);

    // Create Categories
    categoryA = await Category.create({
      name: "Analytics Test Cat Alpha",
      organization: orgA._id,
      color: "#FF0000",
      description: "Alpha Category",
    });

    categoryB = await Category.create({
      name: "Analytics Test Cat Beta",
      organization: orgB._id,
      color: "#00FF00",
      description: "Beta Category",
    });

    // Create Complaints for Org Alpha
    complaintA1 = await Complaint.create({
      complaintId: `ANAFEED-A1-${Date.now()}`,
      title: "Analytics & Feedback Test Complaint A1",
      description: "Detailed description for Alpha 1 test complaint with more than twenty characters.",
      organization: orgA._id,
      category: categoryA._id,
      priority: "high",
      status: "resolved",
      user: userA1._id,
      assignedTo: staffA1._id,
      timeline: {
        submittedAt: new Date(Date.now() - 3600000 * 2),
        resolvedAt: new Date(Date.now() - 3600000 * 1),
      },
    });

    complaintA2 = await Complaint.create({
      complaintId: `ANAFEED-A2-${Date.now()}`,
      title: "Analytics & Feedback Test Complaint A2",
      description: "Detailed description for Alpha 2 test complaint with more than twenty characters.",
      organization: orgA._id,
      category: categoryA._id,
      priority: "medium",
      status: "in-progress",
      user: userA2._id,
      assignedTo: staffA1._id,
    });

    // Create Complaint for Org Beta
    complaintB1 = await Complaint.create({
      complaintId: `ANAFEED-B1-${Date.now()}`,
      title: "Analytics & Feedback Test Complaint B1",
      description: "Detailed description for Beta 1 test complaint with more than twenty characters.",
      organization: orgB._id,
      category: categoryB._id,
      priority: "critical",
      status: "resolved",
      user: userB1._id,
      assignedTo: staffB1._id,
      timeline: {
        submittedAt: new Date(Date.now() - 3600000 * 5),
        resolvedAt: new Date(Date.now() - 3600000 * 3),
      },
    });

    // Ensure explicit timeline timestamps without pre-save middleware overrides
    const twoHoursAgo = new Date(Date.now() - 3600000 * 2);
    const oneHourAgo = new Date(Date.now() - 3600000 * 1);
    await Complaint.updateOne(
      { _id: complaintA1._id },
      {
        $set: {
          "timeline.submittedAt": twoHoursAgo,
          "timeline.resolvedAt": oneHourAgo,
        },
      },
    );

    const fiveHoursAgo = new Date(Date.now() - 3600000 * 5);
    const threeHoursAgo = new Date(Date.now() - 3600000 * 3);
    await Complaint.updateOne(
      { _id: complaintB1._id },
      {
        $set: {
          "timeline.submittedAt": fiveHoursAgo,
          "timeline.resolvedAt": threeHoursAgo,
        },
      },
    );

    // Create Feedback for Complaint A1 (Org Alpha)
    feedbackA1 = await Feedback.create({
      complaint: complaintA1._id,
      user: userA1._id,
      resolvedBy: staffA1._id,
      rating: 5,
      comments: "Analytics & Feedback Test: Excellent resolution from Alpha staff!",
      satisfactionLevel: "very_satisfied",
      issueResolved: true,
      needsFollowUp: false,
      isAnonymous: false,
    });
    complaintA1.feedback = feedbackA1._id;
    await complaintA1.save();

    // Create Feedback for Complaint B1 (Org Beta)
    feedbackB1 = await Feedback.create({
      complaint: complaintB1._id,
      user: userB1._id,
      resolvedBy: staffB1._id,
      rating: 2,
      comments: "Analytics & Feedback Test: Poor resolution from Beta staff!",
      satisfactionLevel: "dissatisfied",
      issueResolved: false,
      needsFollowUp: true,
      followUpReason: "Beta user needs further assistance.",
      isAnonymous: false,
    });
    complaintB1.feedback = feedbackB1._id;
    await complaintB1.save();
  });

  afterAll(async () => {
    await cleanupTestRecords();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // 1. Admin Analytics Tenant Isolation
  // ==========================================
  describe("1. Admin Analytics Tenant Isolation (GET /api/admin/analytics)", () => {
    it("Alpha org_admin receives analytics calculated exclusively from Alpha's records", async () => {
      const res = await request(app)
        .get("/api/admin/analytics?period=30d")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // Category breakdown must contain ONLY Alpha category
      const categories = data.categoryBreakdown.map((c) => c.name);
      expect(categories).toContain(categoryA.name);
      expect(categories).not.toContain(categoryB.name);

      // Staff performance must contain ONLY Alpha staff
      const staffMembers = data.staffPerformance.map((s) => s.name);
      expect(staffMembers).toContain(staffA1.name);
      expect(staffMembers).not.toContain(staffB1.name);

      // Verify specific staff performance numbers and resolution rate
      const staffAEntry = data.staffPerformance.find((s) => s.name === staffA1.name);
      expect(staffAEntry).toBeDefined();
      expect(staffAEntry.totalComplaints).toBe(2);
      expect(staffAEntry.resolvedComplaints).toBe(1);
      expect(staffAEntry.resolutionRate).toBe(50);

      // Verify Category avgResolutionHours calculation is based on Alpha timeline only
      const catAEntry = data.categoryBreakdown.find((c) => c.name === categoryA.name);
      expect(catAEntry).toBeDefined();
      expect(catAEntry.count).toBe(2);
      expect(catAEntry.resolved).toBe(1);
      // Timeline submittedAt was 2 hrs ago, resolvedAt was 1 hr ago => 1 hour
      expect(catAEntry.avgResolutionHours).toBeCloseTo(1, 1);

      // SLA metrics must reflect Alpha complaints only (complaintA1 resolved, complaintA2 in-progress)
      expect(data.slaMetrics.total).toBe(2);
      expect(data.slaMetrics.onTime).toBe(2);
      expect(data.slaMetrics.slaComplianceRate).toBe(100);
    });

    it("Beta org_admin receives analytics calculated exclusively from Beta's records", async () => {
      const res = await request(app)
        .get("/api/admin/analytics?period=30d")
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // Category breakdown must contain ONLY Beta category
      const categories = data.categoryBreakdown.map((c) => c.name);
      expect(categories).toContain(categoryB.name);
      expect(categories).not.toContain(categoryA.name);

      // Category avgResolutionHours calculation on Beta timeline
      const catBEntry = data.categoryBreakdown.find((c) => c.name === categoryB.name);
      expect(catBEntry).toBeDefined();
      expect(catBEntry.count).toBe(1);
      expect(catBEntry.resolved).toBe(1);
      // Timeline submittedAt was 5 hrs ago, resolvedAt was 3 hrs ago => 2 hours
      expect(catBEntry.avgResolutionHours).toBeCloseTo(2, 1);

      // Staff performance must contain ONLY Beta staff
      const staffMembers = data.staffPerformance.map((s) => s.name);
      expect(staffMembers).toContain(staffB1.name);
      expect(staffMembers).not.toContain(staffA1.name);

      const staffBEntry = data.staffPerformance.find((s) => s.name === staffB1.name);
      expect(staffBEntry).toBeDefined();
      expect(staffBEntry.totalComplaints).toBe(1);
      expect(staffBEntry.resolvedComplaints).toBe(1);
      expect(staffBEntry.resolutionRate).toBe(100);

      // SLA metrics must reflect Beta complaints only (complaintB1 only)
      expect(data.slaMetrics.total).toBe(1);
    });

    it("Super Admin receives global analytics across all organizations", async () => {
      const res = await request(app)
        .get("/api/admin/analytics?period=30d")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      const categories = data.categoryBreakdown.map((c) => c.name);
      expect(categories).toContain(categoryA.name);
      expect(categories).toContain(categoryB.name);

      const staffMembers = data.staffPerformance.map((s) => s.name);
      expect(staffMembers).toContain(staffA1.name);
      expect(staffMembers).toContain(staffB1.name);

      expect(data.slaMetrics.total).toBeGreaterThanOrEqual(3);
    });

    it("Super Admin can optionally filter analytics by specific organization", async () => {
      const res = await request(app)
        .get(`/api/admin/analytics?period=30d&organization=${orgA._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      const categories = data.categoryBreakdown.map((c) => c.name);
      expect(categories).toContain(categoryA.name);
      expect(categories).not.toContain(categoryB.name);

      const staffMembers = data.staffPerformance.map((s) => s.name);
      expect(staffMembers).toContain(staffA1.name);
      expect(staffMembers).not.toContain(staffB1.name);
    });

    it("Rejects Super Admin analytics query if organization ID format is invalid (HTTP 400)", async () => {
      const res = await request(app)
        .get("/api/admin/analytics?period=30d&organization=invalid-object-id")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid organization ID format");
    });

    it("Ignores foreign organization query parameter passed by org_admin and scopes strictly to own tenant", async () => {
      // Admin A tries to pass orgB in query
      const res = await request(app)
        .get(`/api/admin/analytics?period=30d&organization=${orgB._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Must strictly still be Alpha's data
      const categories = res.body.data.categoryBreakdown.map((c) => c.name);
      expect(categories).toContain(categoryA.name);
      expect(categories).not.toContain(categoryB.name);
    });

    it("Admin Export Complaints is scoped to tenant for org_admin", async () => {
      const res = await request(app)
        .get("/api/admin/export/complaints")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const complaints = res.body.data;
      const ids = complaints.map((c) => c.complaintId);
      expect(ids).toContain(complaintA1.complaintId);
      expect(ids).toContain(complaintA2.complaintId);
      expect(ids).not.toContain(complaintB1.complaintId);
    });

    it("Fails safely with HTTP 403 when an org_admin lacks organization context", async () => {
      // Create admin user, then nullify organization via direct DB update
      const rogueAdmin = await User.create({
        name: "Rogue Admin No Org",
        email: "rogue-admin@analytics-feedback-tenant-test.com",
        password: "Password123!",
        role: "org_admin",
        organization: orgA._id,
        isActive: true,
        isOnboarded: true,
      });

      await User.updateOne({ _id: rogueAdmin._id }, { $set: { organization: null } });

      const rogueToken = generateAccessToken({
        id: rogueAdmin._id.toString(),
        name: rogueAdmin.name,
        email: rogueAdmin.email,
        role: "org_admin",
        organization: null,
      });

      const res = await request(app)
        .get("/api/admin/analytics")
        .set("Authorization", `Bearer ${rogueToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("does not belong to any organization");
    });
  });

  // ==========================================
  // 2. Feedback Listing & Pagination Tenant Isolation
  // ==========================================
  describe("2. Feedback Listing Tenant Isolation (GET /api/feedback)", () => {
    it("Alpha org_admin receives only feedback from Alpha's complaints", async () => {
      const res = await request(app)
        .get("/api/feedback")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const feedbacks = res.body.data.feedbacks;
      const feedbackIds = feedbacks.map((f) => f._id.toString());
      expect(feedbackIds).toContain(feedbackA1._id.toString());
      expect(feedbackIds).not.toContain(feedbackB1._id.toString());

      expect(res.body.data.pagination.totalItems).toBe(1);
    });

    it("Beta org_admin receives only feedback from Beta's complaints", async () => {
      const res = await request(app)
        .get("/api/feedback")
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const feedbacks = res.body.data.feedbacks;
      const feedbackIds = feedbacks.map((f) => f._id.toString());
      expect(feedbackIds).toContain(feedbackB1._id.toString());
      expect(feedbackIds).not.toContain(feedbackA1._id.toString());

      expect(res.body.data.pagination.totalItems).toBe(1);
    });

    it("Super Admin receives all feedback globally", async () => {
      const res = await request(app)
        .get("/api/feedback")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const feedbacks = res.body.data.feedbacks;
      const feedbackIds = feedbacks.map((f) => f._id.toString());
      expect(feedbackIds).toContain(feedbackA1._id.toString());
      expect(feedbackIds).toContain(feedbackB1._id.toString());
      expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // 3. Feedback Details by Complaint Tenant Isolation
  // ==========================================
  describe("3. Feedback Detail by Complaint (GET /api/feedback/complaint/:complaintId)", () => {
    it("Complaint owner in Org Alpha can view their complaint's feedback", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(feedbackA1._id.toString());
      expect(res.body.data.rating).toBe(5);
    });

    it("Assigned staff in Org Alpha can view their resolved complaint's feedback", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${staffA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(feedbackA1._id.toString());
    });

    it("Org Admin of Alpha can view feedback for complaints within Alpha", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(feedbackA1._id.toString());
    });

    it("Org Admin of Beta cannot view feedback for complaints in Alpha (HTTP 404 without data leak)", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Complaint not found");
      expect(res.body.data).toBeUndefined();
    });

    it("User from Beta cannot view feedback for complaints in Alpha (HTTP 404)", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userB1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("Staff from Beta cannot view feedback for complaints in Alpha (HTTP 404)", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${staffB1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("Non-owner user within the same organization is denied (HTTP 403)", async () => {
      const res = await request(app)
        .get(`/api/feedback/complaint/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userA2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Not authorized");
    });
  });

  // ==========================================
  // 4. Feedback Statistics Tenant Isolation
  // ==========================================
  describe("4. Feedback Stats Tenant Isolation (GET /api/feedback/stats)", () => {
    it("Alpha org_admin receives feedback stats calculated exclusively from Alpha's feedback", async () => {
      const res = await request(app)
        .get("/api/feedback/stats")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { overview, ratingDistribution } = res.body.data;
      expect(overview.totalFeedbacks).toBe(1);
      expect(overview.averageRating).toBe(5);
      expect(ratingDistribution[5]).toBe(1);
      expect(ratingDistribution[2]).toBe(0);
    });

    it("Beta org_admin receives feedback stats calculated exclusively from Beta's feedback", async () => {
      const res = await request(app)
        .get("/api/feedback/stats")
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { overview, ratingDistribution } = res.body.data;
      expect(overview.totalFeedbacks).toBe(1);
      expect(overview.averageRating).toBe(2);
      expect(ratingDistribution[2]).toBe(1);
      expect(ratingDistribution[5]).toBe(0);
    });
  });

  // ==========================================
  // 5. Feedback Actions & Mutation Tenant Isolation
  // ==========================================
  describe("5. Feedback Mutation Tenant Isolation", () => {
    it("Org Admin Beta cannot respond to feedback belonging to Alpha (HTTP 404)", async () => {
      const res = await request(app)
        .post(`/api/feedback/${feedbackA1._id}/respond`)
        .set("Authorization", `Bearer ${adminBToken}`)
        .send({ response: "Unauthorized attempt by Beta to respond to Alpha feedback." });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Feedback not found");
    });

    it("Org Admin Alpha can respond to feedback belonging to Alpha", async () => {
      const res = await request(app)
        .post(`/api/feedback/${feedbackA1._id}/respond`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ response: "Thank you for your feedback! Alpha Team." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adminResponse.response).toBe(
        "Thank you for your feedback! Alpha Team.",
      );
    });

    it("Org Admin Beta cannot flag feedback belonging to Alpha (HTTP 404)", async () => {
      const res = await request(app)
        .put(`/api/feedback/${feedbackA1._id}/flag`)
        .set("Authorization", `Bearer ${adminBToken}`)
        .send({ reason: "Malicious flag attempt across tenants" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Feedback not found");
    });

    it("Org Admin Beta cannot delete feedback belonging to Alpha (HTTP 404)", async () => {
      const res = await request(app)
        .delete(`/api/feedback/${feedbackA1._id}`)
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Feedback not found");

      // Verify record still exists
      const stillExists = await Feedback.findById(feedbackA1._id);
      expect(stillExists).not.toBeNull();
    });
  });
});
