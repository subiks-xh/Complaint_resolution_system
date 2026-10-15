const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const AssignmentRule = require("../../models/AssignmentRule");
const AssignmentLog = require("../../models/AssignmentLog");
const { generateAccessToken } = require("../../config/jwt");

describe("Assignment Routes and Collision Disambiguation Integration Tests", () => {
  let orgA, orgB;
  let adminA, staffA1, staffA2, userA;
  let adminB, staffB;
  let superAdmin;
  let categoryA;
  let adminAToken, staffA1Token, userAToken, adminBToken, superAdminToken;
  let complaintA;
  let testUserIdList = [];

  const cleanupTestRecords = async () => {
    const testUsers = await User.find({ email: /@assignment-test\.com$/ }).select('_id');
    const userIds = testUsers.map((u) => u._id);
    await Promise.all([
      User.deleteMany({ email: /@assignment-test\.com$/ }),
      Organization.deleteMany({ code: /ASSTEST/ }),
      Category.deleteMany({ name: /Assignment Test Category/ }),
      Complaint.deleteMany({ title: /Assignment Test/ }),
      AssignmentRule.deleteMany({ name: /Test Rule/ }),
      AssignmentLog.deleteMany({
        $or: [
          { assignedBy: { $in: userIds } },
          { assignedTo: { $in: userIds } },
        ],
      }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_assignment_test";

    // Enforce strict safety: URI must clearly indicate an isolated test database
    const ALLOWED_TEST_DBS = [
      "complaint_system_assignment_test",
      "complaint_system_category_tenant_test",
      "complaint_system_test",
      "complaint_resolution_test",
    ];

    // Parse database name from URI safely
    const parsedPath = testDbUri.replace(/^mongodb(?:\+srv)?:\/\/[^\/]+\/?/, "").split("?")[0];
    const uriDbName = parsedPath.trim();

    // Safety: Both allowlist AND strict naming convention are required
    const isUriDbAllowed = ALLOWED_TEST_DBS.includes(uriDbName);
    const isUriDbNamedTest = /(?:_test|test_|-test|test-)$/i.test(uriDbName);

    if (!isUriDbAllowed || !isUriDbNamedTest) {
      throw new Error(
        `Safety Abort: TEST_MONGODB_URI database name "${uriDbName}" must be in ALLOWED_TEST_DBS and match the strict test naming suffix.`
      );
    }

    // Never reuse an existing non-test connection
    if (mongoose.connection.readyState !== 0) {
      const currentDbName = mongoose.connection.name || "";
      const isCurrentDbSafe =
        ALLOWED_TEST_DBS.includes(currentDbName) &&
        /(?:_test|test_|-test|test-)$/i.test(currentDbName);
      if (!isCurrentDbSafe) {
        await mongoose.disconnect();
      }
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    // Verify the actual connected database name before running any query
    const activeDbName = mongoose.connection.name || "";
    const isActiveDbSafe =
      ALLOWED_TEST_DBS.includes(activeDbName) &&
      /(?:_test|test_|-test|test-)$/i.test(activeDbName);

    if (!isActiveDbSafe) {
      await mongoose.disconnect();
      throw new Error(
        `Safety Abort: Active connected database "${activeDbName}" is not on the test database allowlist or does not match strict test naming rules.`
      );
    }

    // Clean test collections safely
    await cleanupTestRecords();

    // Create Organizations
    orgA = await Organization.create({
      name: "Assignment Test Org A",
      code: "ASSTEST-A",
      email: "org-a@assignment-test.com",
    });

    orgB = await Organization.create({
      name: "Assignment Test Org B",
      code: "ASSTEST-B",
      email: "org-b@assignment-test.com",
    });

    // Create Users for Org A
    adminA = await User.create({
      name: "Admin A",
      email: "admin-a@assignment-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      isEmailVerified: true,
    });

    staffA1 = await User.create({
      name: "Staff A1",
      email: "staff-a1@assignment-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      maxAssignedComplaints: 5,
    });

    staffA2 = await User.create({
      name: "Staff A2",
      email: "staff-a2@assignment-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      maxAssignedComplaints: 5,
    });

    userA = await User.create({
      name: "User A",
      email: "user-a@assignment-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
    });

    // Create Users for Org B
    adminB = await User.create({
      name: "Admin B",
      email: "admin-b@assignment-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
    });

    staffB = await User.create({
      name: "Staff B",
      email: "staff-b@assignment-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      isActive: true,
    });

    // Create Super Admin (platform-wide, no specific organization)
    superAdmin = await User.create({
      name: "Super Admin",
      email: "superadmin@assignment-test.com",
      password: "Password123!",
      role: "super_admin",
      isActive: true,
    });

    testUserIdList = [adminA._id, staffA1._id, staffA2._id, userA._id, adminB._id, staffB._id, superAdmin._id];

    // Create Category in Org A
    categoryA = await Category.create({
      name: "Assignment Test Category",
      organization: orgA._id,
      slug: `asstest-cat-${Date.now()}`,
      resolutionSLA: { low: 72, medium: 48, high: 24, critical: 4 },
    });

    // Generate tokens
    adminAToken = generateAccessToken(adminA);
    staffA1Token = generateAccessToken(staffA1);
    userAToken = generateAccessToken(userA);
    adminBToken = generateAccessToken(adminB);
    superAdminToken = generateAccessToken(superAdmin);
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

  beforeEach(async () => {
    // Fresh complaint for each test
    complaintA = await Complaint.create({
      title: "Assignment Test Complaint",
      description: "This is a detailed description for assignment test complaint.",
      category: categoryA._id,
      priority: "medium",
      user: userA._id,
      organization: orgA._id,
      status: "new",
      timeline: { submittedAt: new Date(), lastUpdatedAt: new Date() },
    });
  });

  test("1. Unauthorized users (regular user and staff) cannot invoke assignment endpoints", async () => {
    // Regular user attempt on manual assign
    const resUserManual = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ staffId: staffA1._id.toString() });
    expect(resUserManual.status).toBe(403);

    // Regular user attempt on rule-based assign
    const resUserRule = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ staffId: staffA1._id.toString() });
    expect(resUserRule.status).toBe(403);

    // Staff attempt on dedicated namespace
    const resStaffDedicated = await request(app)
      .post(`/api/admin/assignments/complaints/${complaintA._id}/assign`)
      .set("Authorization", `Bearer ${staffA1Token}`)
      .send({ staffId: staffA1._id.toString() });
    expect(resStaffDedicated.status).toBe(403);
  });

  test("2. Manual assign endpoint (/api/admin/complaints/:id/assign) executes manual admin assignment", async () => {
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({
        staffId: staffA1._id.toString(),
        remarks: "Assigned manually by Admin A",
        priority: "high",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedTo._id.toString()).toBe(staffA1._id.toString());
    expect(res.body.data.status).toBe("assigned");
    expect(res.body.data.priority).toBe("high");

    const updated = await Complaint.findById(complaintA._id);
    expect(updated.assignedTo.toString()).toBe(staffA1._id.toString());
    expect(updated.statusHistory.some((s) => s.status === "assigned")).toBe(true);
  });

  test("3. Advanced rule-based assignment endpoint (/api/admin/complaints/:id/assign-with-rules) is reachable and logs assignment", async () => {
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({
        staffId: staffA2._id.toString(),
        assignmentConfig: {
          assignmentType: "rule-based",
          assignmentNotes: "Automated test rule assignment",
          priority: "critical",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignmentLog).toBeDefined();

    // Verify database updates
    const updated = await Complaint.findById(complaintA._id);
    expect(updated.assignedTo.toString()).toBe(staffA2._id.toString());
    expect(updated.status).toBe("assigned");
    expect(updated.priority).toBe("critical");

    // Verify AssignmentLog was saved
    const log = await AssignmentLog.findById(res.body.data.assignmentLog);
    expect(log).toBeDefined();
    expect(log.assignedTo.toString()).toBe(staffA2._id.toString());
    expect(log.assignedBy.toString()).toBe(adminA._id.toString());
  });

  test("4. Dedicated /api/admin/assignments namespace is reachable and functional", async () => {
    const res = await request(app)
      .post(`/api/admin/assignments/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({
        staffId: staffA1._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignmentLog).toBeDefined();
  });

  test("5. Cross-organization assignment rejection: Admin cannot assign complaints from another organization", async () => {
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${adminBToken}`)
      .send({
        staffId: staffB._id.toString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("6. Cross-organization staff rejection: Admin cannot assign staff belonging to another organization", async () => {
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({
        staffId: staffB._id.toString(), // staffB belongs to Org B, complaintA belongs to Org A
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found or does not belong to your organization/i);
  });

  test("7. Super Admin can assign complaints across organizations to eligible staff", async () => {
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        staffId: staffA1._id.toString(),
        assignmentConfig: {
          assignmentNotes: "Super Admin assigned to Org A staff",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedStaff.email).toBe(staffA1.email);

    // And verify the AssignmentLog was associated with the complaint's organization
    const log = await AssignmentLog.findById(res.body.data.assignmentLog);
    expect(log).toBeDefined();
    expect(log.organization.toString()).toBe(orgA._id.toString());
  });

  test("8. Super Admin cannot assign mismatched cross-organization staff to complaint", async () => {
    // Super Admin cannot assign Staff B (Org B) to Complaint A (Org A)
    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        staffId: staffB._id.toString(),
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("9. Missing organization on user or complaint is handled gracefully without 500", async () => {
    // Generate a valid token for an admin without an organization
    const unorganizedUserId = new mongoose.Types.ObjectId();
    const unorganizedToken = generateAccessToken({
      id: unorganizedUserId.toString(),
      role: "org_admin",
      organization: null,
    });

    const res = await request(app)
      .post(`/api/admin/complaints/${complaintA._id}/assign-with-rules`)
      .set("Authorization", `Bearer ${unorganizedToken}`)
      .send({ staffId: staffA1._id.toString() });

    // Should return 401 (if user not in DB) or 403 Forbidden without throwing 500
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
