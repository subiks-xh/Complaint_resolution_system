const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const Notification = require("../../models/Notification");
const { generateAccessToken } = require("../../config/jwt");

describe("Admin Actions and Staff Isolation Integration Tests (Group 2)", () => {
  let orgA, orgB;
  let adminA, staffA1, staffA2, userA;
  let adminB, staffB1, userB;
  let superAdmin, staffUnassigned;
  let adminAToken, staffA1Token, staffA2Token, userAToken;
  let adminBToken, staffB1Token, userBToken;
  let superAdminToken;
  let categoryA, categoryB;
  let complaintA1, complaintA2, complaintB1;

  const ALLOWED_TEST_DBS = [
    "complaint_system_assignment_test",
    "complaint_system_category_tenant_test",
    "complaint_system_complaint_tenant_test",
    "complaint_system_analytics_feedback_tenant_test",
    "complaint_system_admin_actions_staff_tenant_test",
    "complaint_system_test",
    "complaint_resolution_test",
  ];
  const TEST_DB_REGEX = /(?:_test|test_|-test|test-)$/i;

  const cleanupTestRecords = async () => {
    await Promise.all([
      Notification.deleteMany({
        $or: [
          { title: /Reassignment Request/ },
          { message: /Admin Actions & Staff Test/ },
          { message: /AAST/ },
        ],
      }),
      Complaint.deleteMany({ title: /Admin Actions & Staff Test/ }),
      Category.deleteMany({ name: /Admin Actions Test Cat/ }),
      User.deleteMany({ email: /@admin-actions-staff-test\.com$/ }),
      Organization.deleteMany({ code: /AAST/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_admin_actions_staff_tenant_test";

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
        `Safety Abort: Active connected database "${activeDbName}" is not an allowed safe test database.`,
      );
    }

    await cleanupTestRecords();

    // 1. Create two Organizations
    orgA = await Organization.create({
      name: "Org A Admin Actions",
      code: "AAST-ORGA",
      email: "admin@orga.admin-actions-staff-test.com",
      status: "active",
    });

    orgB = await Organization.create({
      name: "Org B Admin Actions",
      code: "AAST-ORGB",
      email: "admin@orgb.admin-actions-staff-test.com",
      status: "active",
    });

    // 2. Create Users
    adminA = await User.create({
      name: "Admin Org A",
      email: "admin.a@admin-actions-staff-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      emailVerified: true,
    });

    staffA1 = await User.create({
      name: "Staff 1 Org A",
      email: "staff.a1@admin-actions-staff-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      department: "Technical Support",
      isActive: true,
      emailVerified: true,
    });

    staffA2 = await User.create({
      name: "Staff 2 Org A",
      email: "staff.a2@admin-actions-staff-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      department: "Customer Service",
      isActive: true,
      emailVerified: true,
    });

    userA = await User.create({
      name: "User Org A",
      email: "user.a@admin-actions-staff-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      emailVerified: true,
    });

    adminB = await User.create({
      name: "Admin Org B",
      email: "admin.b@admin-actions-staff-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      emailVerified: true,
    });

    staffB1 = await User.create({
      name: "Staff 1 Org B",
      email: "staff.b1@admin-actions-staff-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      department: "Operations",
      isActive: true,
      emailVerified: true,
    });

    userB = await User.create({
      name: "User Org B",
      email: "user.b@admin-actions-staff-test.com",
      password: "Password123!",
      role: "user",
      organization: orgB._id,
      isActive: true,
      emailVerified: true,
    });

    superAdmin = await User.create({
      name: "Global Super Admin",
      email: "superadmin@admin-actions-staff-test.com",
      password: "Password123!",
      role: "super_admin",
      organization: null,
      isActive: true,
      emailVerified: true,
    });

    staffUnassigned = await User.create({
      name: "Staff Unassigned Org",
      email: "staff.unassigned@admin-actions-staff-test.com",
      password: "Password123!",
      role: "staff",
      organization: null,
      department: "General Pool",
      isActive: true,
      emailVerified: true,
    });

    // 3. Generate tokens
    adminAToken = generateAccessToken(adminA);
    staffA1Token = generateAccessToken(staffA1);
    staffA2Token = generateAccessToken(staffA2);
    userAToken = generateAccessToken(userA);

    adminBToken = generateAccessToken(adminB);
    staffB1Token = generateAccessToken(staffB1);
    userBToken = generateAccessToken(userB);

    superAdminToken = generateAccessToken(superAdmin);

    // 4. Create Categories
    categoryA = await Category.create({
      name: "Admin Actions Test Cat A",
      organization: orgA._id,
      isActive: true,
    });

    categoryB = await Category.create({
      name: "Admin Actions Test Cat B",
      organization: orgB._id,
      isActive: true,
    });

    // 5. Create Complaints
    complaintA1 = await Complaint.create({
      title: "Admin Actions & Staff Test Complaint A1",
      description: "Complaint for testing close and escalation in Org A",
      user: userA._id,
      category: categoryA._id,
      organization: orgA._id,
      status: "assigned",
      assignedTo: staffA1._id,
      assignedBy: adminA._id,
      priority: "medium",
    });

    complaintA2 = await Complaint.create({
      title: "Admin Actions & Staff Test Complaint A2",
      description: "Second complaint for reassignment in Org A",
      user: userA._id,
      category: categoryA._id,
      organization: orgA._id,
      status: "assigned",
      assignedTo: staffA1._id,
      assignedBy: adminA._id,
      priority: "high",
    });

    complaintB1 = await Complaint.create({
      title: "Admin Actions & Staff Test Complaint B1",
      description: "Complaint for testing cross-tenant boundaries in Org B",
      user: userB._id,
      category: categoryB._id,
      organization: orgB._id,
      status: "assigned",
      assignedTo: staffB1._id,
      assignedBy: adminB._id,
      priority: "medium",
    });
  });

  afterAll(async () => {
    try {
      await cleanupTestRecords();
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });

  describe("1. Complaint Closure (closeComplaint)", () => {
    it("allows Org Admin A to close an eligible complaint within Org A", async () => {
      const res = await request(app)
        .put(`/api/admin/complaints/${complaintA1._id}/close`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ remarks: "Successfully resolved and closed by Admin A" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("closed");

      // Verify in DB
      const updated = await Complaint.findById(complaintA1._id);
      expect(updated.status).toBe("closed");
      expect(updated.timeline.closedAt).toBeTruthy();
      expect(updated.statusHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "closed",
            changedBy: adminA._id,
            changedByRole: "admin",
            remarks: "Successfully resolved and closed by Admin A",
          }),
        ]),
      );
    });

    it("prevents Org Admin A from closing a foreign-tenant complaint in Org B (returns 404)", async () => {
      const initialB = await Complaint.findById(complaintB1._id);
      const initialHistoryLength = initialB.statusHistory.length;

      const res = await request(app)
        .put(`/api/admin/complaints/${complaintB1._id}/close`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ remarks: "Unauthorized closure attempt by foreign admin" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Complaint not found/i);

      // Verify foreign record was untouched
      const afterAttempt = await Complaint.findById(complaintB1._id);
      expect(afterAttempt.status).toBe("assigned");
      expect(afterAttempt.timeline.closedAt).toBeUndefined();
      expect(afterAttempt.statusHistory.length).toBe(initialHistoryLength);
    });

    it("returns 400 when closing an already closed complaint", async () => {
      const res = await request(app)
        .put(`/api/admin/complaints/${complaintA1._id}/close`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ remarks: "Closing again" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already closed/i);
    });

    it("allows Super Admin global access to close complaints across tenants", async () => {
      const res = await request(app)
        .put(`/api/admin/complaints/${complaintB1._id}/close`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ remarks: "Closed globally by Super Admin" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("closed");

      const updated = await Complaint.findById(complaintB1._id);
      expect(updated.status).toBe("closed");
      expect(updated.statusHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "closed",
            changedBy: superAdmin._id,
            changedByRole: "admin",
            remarks: "Closed globally by Super Admin",
          }),
        ]),
      );
    });

    it("denies regular user from accessing close endpoint", async () => {
      const res = await request(app)
        .put(`/api/admin/complaints/${complaintA2._id}/close`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ remarks: "User closure attempt" });

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid complaint ObjectId", async () => {
      const res = await request(app)
        .put(`/api/admin/complaints/invalid-object-id/close`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ remarks: "Invalid ID test" });

      expect(res.status).toBe(400);
    });
  });

  describe("2. Forced Escalation (escalateComplaint)", () => {
    it("allows Org Admin A to escalate an eligible complaint in Org A", async () => {
      const res = await request(app)
        .post(`/api/admin/complaints/${complaintA2._id}/escalate`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          reason: "Customer has waited over 48 hours with no update.",
          reassignTo: staffA2._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("escalated");
      expect(res.body.data.assignedTo._id.toString()).toBe(staffA2._id.toString());

      // DB check
      const updated = await Complaint.findById(complaintA2._id);
      expect(updated.status).toBe("escalated");
      expect(updated.assignedTo.toString()).toBe(staffA2._id.toString());
      expect(updated.escalationLevel).toBe(1);
      expect(updated.escalationHistory.length).toBe(1);
      expect(updated.escalationHistory[0].reason).toMatch(/waited over 48 hours/);
      expect(updated.escalationHistory[0].reassignedTo.toString()).toBe(staffA2._id.toString());
    });

    it("prevents duplicate escalation when already escalated", async () => {
      const res = await request(app)
        .post(`/api/admin/complaints/${complaintA2._id}/escalate`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          reason: "Attempting duplicate escalation",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already escalated/i);
    });

    it("prevents Org Admin A from escalating a foreign complaint in Org B (returns 404)", async () => {
      // Create a fresh open complaint in Org B
      const freshComplaintB = await Complaint.create({
        title: "Admin Actions & Staff Test Complaint B2",
        description: "Fresh complaint in Org B for escalation tests",
        user: userB._id,
        category: categoryB._id,
        organization: orgB._id,
        status: "assigned",
        assignedTo: staffB1._id,
        assignedBy: adminB._id,
        priority: "medium",
      });

      const res = await request(app)
        .post(`/api/admin/complaints/${freshComplaintB._id}/escalate`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          reason: "Cross-tenant unauthorized escalation attempt.",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Complaint not found/i);

      // Verify no mutation
      const checkB = await Complaint.findById(freshComplaintB._id);
      expect(checkB.status).toBe("assigned");
      expect(checkB.escalationLevel).toBe(0);
      expect(checkB.escalationHistory.length).toBe(0);
    });

    it("prevents Org Admin A from reassigning to a staff member belonging to Org B", async () => {
      const freshComplaintA = await Complaint.create({
        title: "Admin Actions & Staff Test Complaint A3",
        description: "Complaint for testing invalid cross-tenant reassignTo",
        user: userA._id,
        category: categoryA._id,
        organization: orgA._id,
        status: "assigned",
        assignedTo: staffA1._id,
        assignedBy: adminA._id,
        priority: "medium",
      });

      const res = await request(app)
        .post(`/api/admin/complaints/${freshComplaintA._id}/escalate`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          reason: "Escalating but trying to reassign to Org B staff",
          reassignTo: staffB1._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Reassignment target must belong to the complaint's organization/i);

      // Ensure no escalation happened
      const checkA = await Complaint.findById(freshComplaintA._id);
      expect(checkA.status).toBe("assigned");
      expect(checkA.escalationLevel).toBe(0);
    });

    it("allows Super Admin to escalate any complaint", async () => {
      const freshComplaintB = await Complaint.create({
        title: "Admin Actions & Staff Test Complaint B3",
        description: "Complaint for Super Admin escalation",
        user: userB._id,
        category: categoryB._id,
        organization: orgB._id,
        status: "assigned",
        assignedTo: staffB1._id,
        assignedBy: adminB._id,
        priority: "medium",
      });

      const res = await request(app)
        .post(`/api/admin/complaints/${freshComplaintB._id}/escalate`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          reason: "Super Admin forced escalation due to SLA issue.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("escalated");

      const checkB = await Complaint.findById(freshComplaintB._id);
      expect(checkB.status).toBe("escalated");
      expect(checkB.escalationLevel).toBe(1);
    });
  });

  describe("3. Staff Directory (getAllStaff)", () => {
    it("allows Super Admin to retrieve the global staff directory without crashing", async () => {
      const res = await request(app)
        .get("/api/admin/staff")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.staff)).toBe(true);

      const staffEmails = res.body.data.staff.map((s) => s.email);
      // Global list should contain staff from both org A and org B
      expect(staffEmails).toContain("staff.a1@admin-actions-staff-test.com");
      expect(staffEmails).toContain("staff.a2@admin-actions-staff-test.com");
      expect(staffEmails).toContain("staff.b1@admin-actions-staff-test.com");
    });

    it("allows Super Admin to filter staff by a valid organization", async () => {
      const res = await request(app)
        .get(`/api/admin/staff?organization=${orgA._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const staffEmails = res.body.data.staff.map((s) => s.email);
      expect(staffEmails).toContain("staff.a1@admin-actions-staff-test.com");
      expect(staffEmails).toContain("staff.a2@admin-actions-staff-test.com");
      expect(staffEmails).not.toContain("staff.b1@admin-actions-staff-test.com");
    });

    it("returns 400 when Super Admin provides an invalid organization ID format", async () => {
      const res = await request(app)
        .get("/api/admin/staff?organization=not-a-valid-id")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid organization ID format/i);
    });

    it("restricts Org Admin A strictly to Org A staff members", async () => {
      const res = await request(app)
        .get("/api/admin/staff")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const staffList = res.body.data.staff;
      const staffEmails = staffList.map((s) => s.email);

      expect(staffEmails).toContain("staff.a1@admin-actions-staff-test.com");
      expect(staffEmails).toContain("staff.a2@admin-actions-staff-test.com");
      expect(staffEmails).not.toContain("staff.b1@admin-actions-staff-test.com");

      // Verify counts and pagination
      expect(res.body.data.pagination.totalItems).toBe(2);
    });

    it("ignores or overrides organization query parameter when called by Org Admin A", async () => {
      // Org Admin A attempts to pass Org B ID in query
      const res = await request(app)
        .get(`/api/admin/staff?organization=${orgB._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Must strictly still return Org A staff
      const staffEmails = res.body.data.staff.map((s) => s.email);
      expect(staffEmails).toContain("staff.a1@admin-actions-staff-test.com");
      expect(staffEmails).toContain("staff.a2@admin-actions-staff-test.com");
      expect(staffEmails).not.toContain("staff.b1@admin-actions-staff-test.com");
    });

    it("scopes search and department filters within tenant boundaries", async () => {
      const res = await request(app)
        .get("/api/admin/staff?search=Staff&department=Technical%20Support")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.length).toBe(1);
      expect(res.body.data.staff[0].email).toBe("staff.a1@admin-actions-staff-test.com");
    });

    it("includes staff with null or unassigned organization in Super Admin directory without crashing", async () => {
      const res = await request(app)
        .get("/api/admin/staff")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unassignedMember = res.body.data.staff.find(
        (s) => s.email === "staff.unassigned@admin-actions-staff-test.com"
      );
      expect(unassignedMember).toBeDefined();
      expect(unassignedMember.organization).toBeNull();
      expect(unassignedMember.name).toBe("Staff Unassigned Org");

      // Verify assigned staff has populated organization object
      const assignedMember = res.body.data.staff.find(
        (s) => s.email === "staff.a1@admin-actions-staff-test.com"
      );
      expect(assignedMember).toBeDefined();
      expect(assignedMember.organization).toEqual(
        expect.objectContaining({
          _id: orgA._id.toString(),
          name: orgA.name,
          code: orgA.code,
        })
      );
    });

    it("allows Super Admin to view performance and toggle status for staff across organizations or unassigned", async () => {
      // 1. Performance for unassigned staff
      const perfResUnassigned = await request(app)
        .get(`/api/admin/staff/${staffUnassigned._id}/performance`)
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(perfResUnassigned.status).toBe(200);
      expect(perfResUnassigned.body.success).toBe(true);

      // 2. Performance for Org B staff
      const perfResB = await request(app)
        .get(`/api/admin/staff/${staffB1._id}/performance`)
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(perfResB.status).toBe(200);
      expect(perfResB.body.success).toBe(true);

      // 3. Status toggle for unassigned staff (who has 0 active assignments) by Super Admin
      const statusRes = await request(app)
        .put(`/api/admin/staff/${staffUnassigned._id}/status`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isActive: false });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);

      // Re-enable unassigned staff
      await request(app)
        .put(`/api/admin/staff/${staffUnassigned._id}/status`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isActive: true });

      // Cannot deactivate staff with active assignments (e.g. staffB1)
      const busyStatusRes = await request(app)
        .put(`/api/admin/staff/${staffB1._id}/status`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isActive: false });
      expect(busyStatusRes.status).toBe(400);
      expect(busyStatusRes.body.message).toMatch(/active assignments/i);

      // 4. Org Admin A cannot view performance or update status for unassigned staff or Org B staff
      const orgAdminPerfForeign = await request(app)
        .get(`/api/admin/staff/${staffB1._id}/performance`)
        .set("Authorization", `Bearer ${adminAToken}`);
      expect(orgAdminPerfForeign.status).toBe(404);

      const orgAdminPerfUnassigned = await request(app)
        .get(`/api/admin/staff/${staffUnassigned._id}/performance`)
        .set("Authorization", `Bearer ${adminAToken}`);
      expect(orgAdminPerfUnassigned.status).toBe(404);
    });

    it("allows Super Admin to add and view feedback for any staff member while restricting Org Admin", async () => {
      // Super Admin adds feedback to Org B staff with valid category 'technical'
      const feedbackRes = await request(app)
        .post(`/api/admin/staff/${staffB1._id}/feedback`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          rating: 5,
          comment: "Super Admin commendation for cross-tenant operations.",
          category: "technical",
        });
      expect(feedbackRes.status).toBe(201);
      expect(feedbackRes.body.success).toBe(true);

      // Super Admin reads feedback
      const getFeedbackRes = await request(app)
        .get(`/api/admin/staff/${staffB1._id}/feedback`)
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(getFeedbackRes.status).toBe(200);
      expect(getFeedbackRes.body.success).toBe(true);
      expect(Array.isArray(getFeedbackRes.body.data)).toBe(true);
      expect(getFeedbackRes.body.data.length).toBeGreaterThan(0);

      // Org Admin A cannot add feedback or read feedback for Org B staff
      const orgAdminAddRes = await request(app)
        .post(`/api/admin/staff/${staffB1._id}/feedback`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ rating: 4, comment: "Unauthorized feedback" });
      expect(orgAdminAddRes.status).toBe(404);

      const orgAdminGetRes = await request(app)
        .get(`/api/admin/staff/${staffB1._id}/feedback`)
        .set("Authorization", `Bearer ${adminAToken}`);
      expect(orgAdminGetRes.status).toBe(404);
    });
  });

  describe("4. Staff Reassignment Notifications (requestReassignment)", () => {
    let reassignComplaintA;

    beforeEach(async () => {
      // Clear all notifications before each test
      await Notification.deleteMany({});

      reassignComplaintA = await Complaint.create({
        title: "Admin Actions & Staff Test Reassignment",
        description: "Testing reassignment notification tenant isolation",
        user: userA._id,
        category: categoryA._id,
        organization: orgA._id,
        status: "assigned",
        assignedTo: staffA1._id,
        assignedBy: adminA._id,
        priority: "medium",
      });
    });

    it("notifies ONLY the complaint organization's admin and global super admins, NOT foreign admins", async () => {
      const res = await request(app)
        .post(`/api/staff/complaints/${reassignComplaintA._id}/request-reassignment`)
        .set("Authorization", `Bearer ${staffA1Token}`)
        .send({
          reason: "I do not have domain knowledge for this specific issue, please reassign.",
          suggestedStaffId: staffA2._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify notifications created
      const notifications = await Notification.find({
        type: "reassignment",
        relatedComplaint: reassignComplaintA._id,
      });

      const recipientIds = notifications.map((n) => n.recipient.toString());

      // Should notify Org Admin A
      expect(recipientIds).toContain(adminA._id.toString());

      // Should notify Super Admin
      expect(recipientIds).toContain(superAdmin._id.toString());

      // MUST NOT notify Org Admin B
      expect(recipientIds).not.toContain(adminB._id.toString());
    });

    it("denies reassignment request if staff is not assigned to the complaint", async () => {
      const res = await request(app)
        .post(`/api/staff/complaints/${reassignComplaintA._id}/request-reassignment`)
        .set("Authorization", `Bearer ${staffA2Token}`)
        .send({
          reason: "I want to reassign someone else's complaint inappropriately.",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not assigned to you/i);

      // Ensure no notifications created
      const notifs = await Notification.find({ relatedComplaint: reassignComplaintA._id });
      expect(notifs.length).toBe(0);
    });

    it("denies suggesting a staff member from a foreign organization", async () => {
      const res = await request(app)
        .post(`/api/staff/complaints/${reassignComplaintA._id}/request-reassignment`)
        .set("Authorization", `Bearer ${staffA1Token}`)
        .send({
          reason: "Suggesting staff from another organization inappropriately.",
          suggestedStaffId: staffB1._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Suggested staff member not found in this organization/i);

      // Ensure no notifications created
      const notifs = await Notification.find({ relatedComplaint: reassignComplaintA._id });
      expect(notifs.length).toBe(0);
    });

    it("rejects reassignment for resolved or closed complaints", async () => {
      reassignComplaintA.status = "closed";
      await reassignComplaintA.save();

      const res = await request(app)
        .post(`/api/staff/complaints/${reassignComplaintA._id}/request-reassignment`)
        .set("Authorization", `Bearer ${staffA1Token}`)
        .send({
          reason: "Attempting to request reassignment on closed complaint.",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot request reassignment for resolved or closed complaints/i);
    });
  });
});
