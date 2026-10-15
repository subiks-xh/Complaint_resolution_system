const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const { generateAccessToken } = require("../../config/jwt");

describe("Complaint Tenant Isolation Integration Tests (Group 2)", () => {
  let orgA, orgB;
  let adminA, staffA1, userA1, userA2;
  let adminB, staffB1, userB1;
  let superAdmin;
  let adminAToken, staffA1Token, userA1Token, userA2Token;
  let adminBToken, staffB1Token, userB1Token;
  let superAdminToken;
  let categoryA1, categoryB1;
  let complaintA1, complaintB1;

  const ALLOWED_TEST_DBS = [
    "complaint_system_assignment_test",
    "complaint_system_category_tenant_test",
    "complaint_system_complaint_tenant_test",
    "complaint_system_test",
    "complaint_resolution_test",
  ];
  const TEST_DB_REGEX = /(?:_test|test_|-test|test-)$/i;

  const cleanupTestRecords = async () => {
    await Promise.all([
      Complaint.deleteMany({ title: /Complaint Tenant Test/ }),
      Category.deleteMany({ name: /Complaint Tenant Cat/ }),
      User.deleteMany({ email: /@complaint-tenant-test\.com$/ }),
      Organization.deleteMany({ code: /CMPTEN/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_complaint_tenant_test";

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
      name: "Tenant Test Org Alpha",
      code: "CMPTEN-A",
      email: "org-alpha@complaint-tenant-test.com",
    });

    orgB = await Organization.create({
      name: "Tenant Test Org Beta",
      code: "CMPTEN-B",
      email: "org-beta@complaint-tenant-test.com",
    });

    // Create Users for Org Alpha
    adminA = await User.create({
      name: "Admin Alpha",
      email: "admin-alpha@complaint-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    staffA1 = await User.create({
      name: "Staff Alpha 1",
      email: "staff-alpha1@complaint-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    userA1 = await User.create({
      name: "User Alpha 1",
      email: "user-alpha1@complaint-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    userA2 = await User.create({
      name: "User Alpha 2",
      email: "user-alpha2@complaint-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });

    // Create Users for Org Beta
    adminB = await User.create({
      name: "Admin Beta",
      email: "admin-beta@complaint-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    staffB1 = await User.create({
      name: "Staff Beta 1",
      email: "staff-beta1@complaint-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    userB1 = await User.create({
      name: "User Beta 1",
      email: "user-beta1@complaint-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    // Create Super Admin (no organization bound)
    superAdmin = await User.create({
      name: "Global Super Admin",
      email: "superadmin@complaint-tenant-test.com",
      password: "Password123!",
      role: "super_admin",
      organization: null,
      isActive: true,
      isOnboarded: true,
    });

    // Generate tokens
    adminAToken = generateAccessToken(adminA);
    staffA1Token = generateAccessToken(staffA1);
    userA1Token = generateAccessToken(userA1);
    userA2Token = generateAccessToken(userA2);
    adminBToken = generateAccessToken(adminB);
    staffB1Token = generateAccessToken(staffB1);
    userB1Token = generateAccessToken(userB1);
    superAdminToken = generateAccessToken(superAdmin);

    // Create Categories
    categoryA1 = await Category.create({
      name: "Complaint Tenant Cat Alpha 1",
      organization: orgA._id,
      isActive: true,
    });

    categoryB1 = await Category.create({
      name: "Complaint Tenant Cat Beta 1",
      organization: orgB._id,
      isActive: true,
    });

    // Create baseline complaints
    complaintA1 = await Complaint.create({
      title: "Complaint Tenant Test Alpha 1 - Network Issue",
      description: "Detailed description of Network Issue in Org Alpha exceeding 20 chars.",
      category: categoryA1._id,
      priority: "high",
      user: userA1._id,
      organization: orgA._id,
      assignedTo: staffA1._id,
      status: "assigned",
      timeline: {
        submittedAt: new Date(),
        assignedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      statusHistory: [
        {
          status: "new",
          changedBy: userA1._id,
          changedByRole: "user",
          remarks: "Initial complaint",
          changedAt: new Date(),
        },
        {
          status: "assigned",
          changedBy: adminA._id,
          changedByRole: "admin",
          remarks: "Assigned to staff Alpha 1",
          changedAt: new Date(),
        },
      ],
    });

    complaintB1 = await Complaint.create({
      title: "Complaint Tenant Test Beta 1 - Electrical Issue",
      description: "Detailed description of Electrical Issue in Org Beta exceeding 20 chars.",
      category: categoryB1._id,
      priority: "medium",
      user: userB1._id,
      organization: orgB._id,
      assignedTo: staffB1._id,
      status: "assigned",
      timeline: {
        submittedAt: new Date(),
        assignedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      statusHistory: [
        {
          status: "new",
          changedBy: userB1._id,
          changedByRole: "user",
          remarks: "Initial complaint in Beta",
          changedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    const activeDbName = mongoose.connection.name || "";
    if (
      ALLOWED_TEST_DBS.includes(activeDbName) &&
      TEST_DB_REGEX.test(activeDbName)
    ) {
      await cleanupTestRecords();
    }
    await mongoose.disconnect();
  });

  // Guard test
  describe("Safety Guard Test", () => {
    it("safely rejects connection to disallowed databases without mutation", () => {
      const disallowedNames = [
        "production_db",
        "complaint_system_prod",
        "complaint_system_dev",
        "test_without_suffix",
      ];
      for (const name of disallowedNames) {
        const isAllowed =
          ALLOWED_TEST_DBS.includes(name) && TEST_DB_REGEX.test(name);
        expect(isAllowed).toBe(false);
      }
    });
  });

  // 1. Complaint Submission Tenant Isolation
  describe("1. POST /api/complaints (Tenant Isolation on Creation)", () => {
    it("successfully creates a complaint when selecting a category belonging to user's organization", async () => {
      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          title: "Complaint Tenant Test Valid Alpha",
          description: "This is a valid complaint description that has plenty of characters.",
          category: categoryA1._id.toString(),
          priority: "medium",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.toString()).toBe(orgA._id.toString());
      const catId = res.body.data.category._id || res.body.data.category;
      expect(catId.toString()).toBe(categoryA1._id.toString());
    });

    it("rejects complaint creation when selecting a category from another organization (HTTP 400)", async () => {
      const countBefore = await Complaint.countDocuments({
        title: "Complaint Tenant Test Cross-Tenant Tampering",
      });

      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          title: "Complaint Tenant Test Cross-Tenant Tampering",
          description: "Attempting to create complaint with Category B belonging to Org Beta.",
          category: categoryB1._id.toString(), // foreign category
          priority: "high",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid category/i);

      // Verify no DB mutation occurred
      const countAfter = await Complaint.countDocuments({
        title: "Complaint Tenant Test Cross-Tenant Tampering",
      });
      expect(countAfter).toBe(countBefore);
    });

    it("ignores client-supplied foreign organization in request body and binds to user's authentic token org", async () => {
      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          title: "Complaint Tenant Test Org Tampering",
          description: "Attempting to override organization with Org Beta in the request body.",
          category: categoryA1._id.toString(),
          organization: orgB._id.toString(), // client tampering attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.data.organization.toString()).toBe(orgA._id.toString());
      expect(res.body.data.organization.toString()).not.toBe(orgB._id.toString());
    });

    it("rejects complaint creation with a non-existent category ID (HTTP 400)", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          title: "Complaint Tenant Test Fake Category",
          description: "Attempting to create complaint with a completely fabricated category ID.",
          category: fakeId.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // 2. Complaint Search Isolation
  describe("2. GET /api/complaints/search (Cross-Tenant Search Scoping)", () => {
    it("Org Admin Alpha search only returns complaints from Org Alpha", async () => {
      const res = await request(app)
        .get("/api/complaints/search?q=Issue")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.complaints.length).toBeGreaterThan(0);

      // Verify every returned complaint belongs strictly to Org Alpha
      for (const complaint of res.body.data.complaints) {
        expect(complaint.organization.toString()).toBe(orgA._id.toString());
        expect(complaint.title).not.toMatch(/Beta/);
      }
    });

    it("Org Admin Beta search only returns complaints from Org Beta", async () => {
      const res = await request(app)
        .get("/api/complaints/search?q=Issue")
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.complaints.length).toBeGreaterThan(0);

      for (const complaint of res.body.data.complaints) {
        expect(complaint.organization.toString()).toBe(orgB._id.toString());
        expect(complaint.title).not.toMatch(/Alpha/);
      }
    });

    it("Staff Alpha search is restricted to assigned or owned complaints within Org Alpha", async () => {
      const res = await request(app)
        .get("/api/complaints/search?q=Issue")
        .set("Authorization", `Bearer ${staffA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      for (const complaint of res.body.data.complaints) {
        expect(complaint.organization.toString()).toBe(orgA._id.toString());
      }
    });

    it("User Alpha 1 search only returns their own complaints", async () => {
      const res = await request(app)
        .get("/api/complaints/search?q=Issue")
        .set("Authorization", `Bearer ${userA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const complaint of res.body.data.complaints) {
        expect(complaint.organization.toString()).toBe(orgA._id.toString());
      }
    });

    it("Super Admin can search globally across all organizations", async () => {
      const res = await request(app)
        .get("/api/complaints/search?q=Issue")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const titles = res.body.data.complaints.map((c) => c.title);
      const hasAlpha = titles.some((t) => t.includes("Alpha"));
      const hasBeta = titles.some((t) => t.includes("Beta"));
      expect(hasAlpha).toBe(true);
      expect(hasBeta).toBe(true);
    });

    it("Super Admin can optionally filter search by a specific organization", async () => {
      const res = await request(app)
        .get(`/api/complaints/search?q=Issue&organization=${orgA._id.toString()}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      for (const complaint of res.body.data.complaints) {
        expect(complaint.organization.toString()).toBe(orgA._id.toString());
      }
    });

    it("Super Admin search with non-existent organization returns 404", async () => {
      const fakeOrgId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/complaints/search?q=Issue&organization=${fakeOrgId.toString()}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // 3. Complaint Timeline Tenant Isolation
  describe("3. GET /api/complaints/:id/timeline (Timeline Access Control)", () => {
    it("allows complaint owner to view timeline in their organization", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${userA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timeline.length).toBeGreaterThan(0);
    });

    it("allows Org Admin Alpha to view timeline of complaints in Org Alpha", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows assigned staff to view timeline in same organization", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${staffA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("denies regular user from viewing another user's complaint timeline in same organization (HTTP 403)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${userA2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("denies Org Admin Beta from viewing Org Alpha complaint timeline (HTTP 404 without leakage)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Complaint not found");
    });

    it("denies Staff Beta from viewing Org Alpha complaint timeline (HTTP 404)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${staffB1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("denies User Beta from viewing Org Alpha complaint timeline (HTTP 404)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${userB1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("allows Super Admin to view any complaint timeline globally", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}/timeline`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 4. Single Complaint Detail Access
  describe("4. GET /api/complaints/:id (Single Complaint Detail)", () => {
    it("allows owner to view complaint detail in same organization", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(complaintA1.title);
    });

    it("denies foreign tenant Org Admin from accessing complaint detail (HTTP 404)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}`)
        .set("Authorization", `Bearer ${adminBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Complaint not found");
    });

    it("denies regular user from viewing another user's complaint in same org (HTTP 403)", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userA2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("allows Super Admin to view complaint detail globally", async () => {
      const res = await request(app)
        .get(`/api/complaints/${complaintA1._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(complaintA1.title);
    });
  });

  // 5. Update, Cancel, and Reopen Tenant Isolation
  describe("5. Mutation Operations Tenant Isolation", () => {
    it("prevents foreign user from reopening a complaint belonging to another tenant (HTTP 404)", async () => {
      const res = await request(app)
        .put(`/api/complaints/${complaintA1._id}/reopen`)
        .set("Authorization", `Bearer ${userB1Token}`)
        .send({
          reason: "Attempting to reopen a complaint belonging to another organization.",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("prevents foreign user from cancelling a complaint belonging to another tenant (HTTP 404)", async () => {
      const res = await request(app)
        .put(`/api/complaints/${complaintA1._id}/cancel`)
        .set("Authorization", `Bearer ${userB1Token}`)
        .send({
          reason: "Attempting to cancel someone else's complaint.",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("prevents non-owner in the same organization from updating a complaint (HTTP 403)", async () => {
      const res = await request(app)
        .put(`/api/complaints/${complaintA1._id}`)
        .set("Authorization", `Bearer ${userA2Token}`)
        .send({
          title: "Attempted Update by Non-owner in same org",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
