const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const { generateAccessToken } = require("../../config/jwt");

describe("Category Tenant Isolation Integration Tests (Group 1: CRS-TENANT-01, CRS-TENANT-02)", () => {
  let orgA, orgB;
  let adminA, staffA1, staffA2, userA;
  let adminB, staffB1;
  let superAdmin;
  let adminAToken, staffA1Token, userAToken, adminBToken, superAdminToken;
  let categoryA1, categoryA2, categoryB1;

  const cleanupTestRecords = async () => {
    await Promise.all([
      User.deleteMany({ email: /@category-tenant-test\.com$/ }),
      Organization.deleteMany({ code: /CATTEN/ }),
      Category.deleteMany({ name: /Category Tenant Test/ }),
      Complaint.deleteMany({ title: /Category Tenant Test/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_category_tenant_test";

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

    // Explicit post-connect verification: verify actual connected database name
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

    // Clean test records before test suite runs
    await cleanupTestRecords();

    // Create Organizations
    orgA = await Organization.create({
      name: "Tenant Test Org A",
      code: "CATTEN-A",
      email: "org-a@category-tenant-test.com",
    });

    orgB = await Organization.create({
      name: "Tenant Test Org B",
      code: "CATTEN-B",
      email: "org-b@category-tenant-test.com",
    });

    // Create Users for Org A
    adminA = await User.create({
      name: "Admin A",
      email: "admin-a@category-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      isEmailVerified: true,
    });

    staffA1 = await User.create({
      name: "Staff A1",
      email: "staff-a1@category-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      isEmailVerified: true,
    });

    staffA2 = await User.create({
      name: "Staff A2",
      email: "staff-a2@category-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      isEmailVerified: true,
    });

    userA = await User.create({
      name: "User A",
      email: "user-a@category-tenant-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isEmailVerified: true,
    });

    // Create Users for Org B
    adminB = await User.create({
      name: "Admin B",
      email: "admin-b@category-tenant-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      isEmailVerified: true,
    });

    staffB1 = await User.create({
      name: "Staff B1",
      email: "staff-b1@category-tenant-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      isActive: true,
      isEmailVerified: true,
    });

    // Create Super Admin
    superAdmin = await User.create({
      name: "Global Super Admin",
      email: "superadmin@category-tenant-test.com",
      password: "Password123!",
      role: "super_admin",
      organization: null,
      isActive: true,
      isEmailVerified: true,
    });

    // Generate JWT tokens
    adminAToken = generateAccessToken(adminA);
    adminBToken = generateAccessToken(adminB);
    staffA1Token = generateAccessToken(staffA1);
    userAToken = generateAccessToken(userA);
    superAdminToken = generateAccessToken(superAdmin);

    // Create initial categories
    categoryA1 = await Category.create({
      name: "Category Tenant Test Org A Primary",
      organization: orgA._id,
      description: "Org A primary category",
      keywords: ["network", "router"],
      displayOrder: 1,
      resolutionSLA: { low: 72, medium: 48, high: 24, critical: 4 },
      assignedStaff: [staffA1._id],
    });

    categoryA2 = await Category.create({
      name: "Category Tenant Test Org A Secondary",
      organization: orgA._id,
      description: "Org A secondary category",
      keywords: ["hardware", "printer"],
      displayOrder: 2,
      resolutionSLA: { low: 72, medium: 48, high: 24, critical: 4 },
      assignedStaff: [],
    });

    categoryB1 = await Category.create({
      name: "Category Tenant Test Org B Primary",
      organization: orgB._id,
      description: "Org B primary category",
      keywords: ["finance", "payroll"],
      displayOrder: 1,
      resolutionSLA: { low: 48, medium: 24, high: 12, critical: 2 },
      assignedStaff: [staffB1._id],
    });
  });

  afterAll(async () => {
    // Verify strict safety before tearDown cleanup
    const ALLOWED_TEST_DBS = [
      "complaint_system_assignment_test",
      "complaint_system_category_tenant_test",
      "complaint_system_test",
      "complaint_resolution_test",
    ];
    const activeDbName = mongoose.connection.name || "";
    const isSafe =
      ALLOWED_TEST_DBS.includes(activeDbName) &&
      /(?:_test|test_|-test|test-)$/i.test(activeDbName);

    if (isSafe) {
      await cleanupTestRecords();
    }
    await mongoose.disconnect();
  });

  describe("1. Permitted Same-Tenant Operations (Org A Admin -> Org A Category)", () => {
    it("allows Org A admin to update SLA on Org A category", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/sla`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          resolutionSLA: {
            low: 80,
            medium: 50,
            high: 20,
            critical: 3,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resolutionSLA.critical).toBe(3);

      const updated = await Category.findById(categoryA1._id);
      expect(updated.resolutionSLA.critical).toBe(3);
    });

    it("allows Org A admin to update keywords on Org A category", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/keywords`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          keywords: ["wifi", "lan"],
          action: "set",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.keywords).toEqual(["wifi", "lan"]);

      const updated = await Category.findById(categoryA1._id);
      expect(updated.keywords).toEqual(["wifi", "lan"]);
    });

    it("allows Org A admin to assign Org A staff to Org A category", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/staff`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          staffIds: [staffA1._id.toString(), staffA2._id.toString()],
          action: "set",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Category.findById(categoryA1._id);
      expect(updated.assignedStaff.map((id) => id.toString())).toContain(
        staffA2._id.toString()
      );
    });

    it("allows Org A admin to reorder categories in Org A", async () => {
      const res = await request(app)
        .put("/api/categories/reorder")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          order: [categoryA2._id.toString(), categoryA1._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const catA2 = await Category.findById(categoryA2._id);
      const catA1 = await Category.findById(categoryA1._id);
      expect(catA2.displayOrder).toBe(0);
      expect(catA1.displayOrder).toBe(1);
    });
  });

  describe("2. Cross-Tenant Rejection (Org A Admin -> Org B Category)", () => {
    it("rejects Org A admin attempting to update Org B category SLA (404 and no change)", async () => {
      const originalCatB = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/sla`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          resolutionSLA: { critical: 1 },
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const unchanged = await Category.findById(categoryB1._id);
      expect(unchanged.resolutionSLA.critical).toBe(
        originalCatB.resolutionSLA.critical
      );
    });

    it("rejects Org A admin attempting to update Org B category keywords (404 and no change)", async () => {
      const originalCatB = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/keywords`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          keywords: ["malicious", "hacked"],
          action: "set",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const unchanged = await Category.findById(categoryB1._id);
      expect(unchanged.keywords).toEqual(originalCatB.keywords);
    });

    it("rejects Org A admin attempting to assign staff to Org B category (404 and no change)", async () => {
      const originalCatB = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/staff`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          staffIds: [staffA1._id.toString()],
          action: "set",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const unchanged = await Category.findById(categoryB1._id);
      expect(unchanged.assignedStaff.map((id) => id.toString())).toEqual(
        originalCatB.assignedStaff.map((id) => id.toString())
      );
    });

    it("rejects reorder request with HTTP 400 when Org A admin includes Org B category ID, keeping state unchanged", async () => {
      const originalCatA1 = await Category.findById(categoryA1._id);
      const originalCatA2 = await Category.findById(categoryA2._id);
      const originalCatB1 = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put("/api/categories/reorder")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          order: [categoryB1._id.toString(), categoryA1._id.toString()],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or belong to another organization/i);

      // Verify no categories in Org A or Org B had their displayOrder changed
      const unchangedCatA1 = await Category.findById(categoryA1._id);
      const unchangedCatA2 = await Category.findById(categoryA2._id);
      const unchangedCatB1 = await Category.findById(categoryB1._id);

      expect(unchangedCatA1.displayOrder).toBe(originalCatA1.displayOrder);
      expect(unchangedCatA2.displayOrder).toBe(originalCatA2.displayOrder);
      expect(unchangedCatB1.displayOrder).toBe(originalCatB1.displayOrder);
    });
  });

  describe("3. Cross-Tenant Staff Assignment Validation", () => {
    it("rejects assigning staff from Org B to Org A category (400 and no change)", async () => {
      const originalCatA = await Category.findById(categoryA1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/staff`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          staffIds: [staffB1._id.toString()],
          action: "add",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or do not belong to this organization/i);

      const unchanged = await Category.findById(categoryA1._id);
      expect(unchanged.assignedStaff.map((id) => id.toString())).not.toContain(
        staffB1._id.toString()
      );
    });

    it("rejects Super Admin assigning staff from Org B to Org A category (400)", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/staff`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          staffIds: [staffB1._id.toString()],
          action: "add",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or do not belong to this organization/i);
    });
  });

  describe("4. Parent Category Cross-Tenant Validation in createCategory", () => {
    it("rejects creating a category in Org A with parent category from Org B (400)", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          name: "Category Tenant Test Child Cross Org",
          parent: categoryB1._id.toString(),
          description: "Illegal cross-tenant child",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/parent category not found in this organization/i);

      // Verify category was not created
      const exists = await Category.findOne({
        name: "Category Tenant Test Child Cross Org",
      });
      expect(exists).toBeNull();
    });

    it("allows creating a valid child category in Org A when parent is also in Org A", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          name: "Category Tenant Test Valid Org A Child",
          parent: categoryA1._id.toString(),
          description: "Valid same-tenant child",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.parent.toString()).toBe(categoryA1._id.toString());
      expect(res.body.data.organization.toString()).toBe(orgA._id.toString());
    });
  });

  describe("5. Super Admin Global Management Operations", () => {
    it("allows Super Admin to update SLA across any organization category", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/sla`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          resolutionSLA: { critical: 1 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resolutionSLA.critical).toBe(1);

      const updated = await Category.findById(categoryB1._id);
      expect(updated.resolutionSLA.critical).toBe(1);
    });

    it("allows Super Admin to update keywords across any organization category", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/keywords`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          keywords: ["super", "admin", "keywords"],
          action: "set",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.keywords).toEqual(["super", "admin", "keywords"]);
    });

    it("allows Super Admin to assign valid staff from Category's organization", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/staff`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          staffIds: [staffB1._id.toString()],
          action: "set",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows Super Admin to create a category by specifying target organization", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Category Tenant Test SuperAdmin Created for Org B",
          organization: orgB._id.toString(),
          description: "Category created by super admin for Org B",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.toString()).toBe(orgB._id.toString());
    });

    it("rejects Super Admin category creation when organization is missing (400)", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Category Tenant Test SuperAdmin Missing Org",
          description: "No organization provided",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/organization context is required/i);
    });

    it("rejects Super Admin category creation when organization ID is invalid format (400)", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Category Tenant Test SuperAdmin Bad Org",
          organization: "invalid-org-id",
          description: "Invalid organization format",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid organization id format/i);
    });

    it("rejects Super Admin category creation when organization does not exist (400)", async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Category Tenant Test SuperAdmin NonExistent Org",
          organization: nonExistentOrgId,
          description: "Non-existent organization",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/target organization not found/i);
    });
  });

  describe("6. Additional Category Handlers Tenant Scoping (update, delete, toggle, stats)", () => {
    it("rejects Org A admin attempting to update Org B category (404 and no change)", async () => {
      const originalCatB = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          name: "Maliciously Renamed Category B",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const unchanged = await Category.findById(categoryB1._id);
      expect(unchanged.name).toBe(originalCatB.name);
    });

    it("rejects Org A admin updating category to have cross-organization parent from Org B (400)", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          parent: categoryB1._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/parent category not found in this organization/i);
    });

    it("rejects Org A admin attempting to toggle status of Org B category (404 and no change)", async () => {
      const originalCatB = await Category.findById(categoryB1._id);

      const res = await request(app)
        .put(`/api/categories/${categoryB1._id}/toggle-status`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const unchanged = await Category.findById(categoryB1._id);
      expect(unchanged.isActive).toBe(originalCatB.isActive);
    });

    it("rejects Org A admin attempting to view category stats of Org B category (404)", async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryB1._id}/stats`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("rejects Org A admin attempting to delete Org B category (404 and no change)", async () => {
      const res = await request(app)
        .delete(`/api/categories/${categoryB1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const stillExists = await Category.findById(categoryB1._id);
      expect(stillExists).not.toBeNull();
    });

    it("prevents deleting category with active complaints unless forceDelete or valid reassignment provided", async () => {
      // Create a test complaint for categoryA1
      const complaint = await Complaint.create({
        title: "Category Tenant Test Complaint",
        description: "Complaint description with sufficient characters to satisfy validation",
        category: categoryA1._id,
        organization: orgA._id,
        user: userA._id,
        status: "new",
      });

      // Attempt deletion without forceDelete or reassignment
      const resBlocked = await request(app)
        .delete(`/api/categories/${categoryA1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(resBlocked.status).toBe(400);
      expect(resBlocked.body.success).toBe(false);
      expect(resBlocked.body.message).toMatch(/cannot delete category with \d+ associated complaints/i);

      // Attempt deletion reassigning to foreign Org B category
      const resCrossReassign = await request(app)
        .delete(`/api/categories/${categoryA1._id}?reassignTo=${categoryB1._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(resCrossReassign.status).toBe(400);
      expect(resCrossReassign.body.success).toBe(false);
      expect(resCrossReassign.body.message).toMatch(/reassignment category not found/i);

      // Verify complaint still references categoryA1
      const checkComplaint = await Complaint.findById(complaint._id);
      expect(checkComplaint.category.toString()).toBe(categoryA1._id.toString());

      // Clean up complaint
      await Complaint.deleteOne({ _id: complaint._id });
    });
  });

  describe("7. Authorization, Missing Context, and Role Handling", () => {
    it("rejects unauthenticated requests (401)", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/sla`)
        .send({ resolutionSLA: { critical: 2 } });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects regular user requests (403)", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/sla`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ resolutionSLA: { critical: 2 } });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects staff requests (403)", async () => {
      const res = await request(app)
        .put(`/api/categories/${categoryA1._id}/sla`)
        .set("Authorization", `Bearer ${staffA1Token}`)
        .send({ resolutionSLA: { critical: 2 } });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects invalid category ID with 400 validation error", async () => {
      const res = await request(app)
        .put("/api/categories/invalid-id/sla")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ resolutionSLA: { critical: 2 } });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("handles non-existent valid ObjectId category safely with 404", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/categories/${nonExistentId}/sla`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ resolutionSLA: { critical: 2 } });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("8. Test Database Safety Guard Validation", () => {
    it("fails closed on disallowed, production, or maliciously crafted database names", () => {
      const ALLOWED_TEST_DBS = [
        "complaint_system_assignment_test",
        "complaint_system_category_tenant_test",
        "complaint_system_test",
        "complaint_resolution_test",
      ];

      const verifySafety = (dbUri, activeDbName) => {
        const parsedPath = dbUri.replace(/^mongodb(?:\+srv)?:\/\/[^\/]+\/?/, "").split("?")[0];
        const uriDbName = parsedPath.trim();

        const isUriDbAllowed = ALLOWED_TEST_DBS.includes(uriDbName);
        const isUriDbNamedTest = /(?:_test|test_|-test|test-)$/i.test(uriDbName);
        if (!isUriDbAllowed || !isUriDbNamedTest) {
          throw new Error(`Safety Abort: URI database "${uriDbName}" rejected.`);
        }

        const isActiveDbAllowed = ALLOWED_TEST_DBS.includes(activeDbName);
        const isActiveDbNamedTest = /(?:_test|test_|-test|test-)$/i.test(activeDbName);
        if (!isActiveDbAllowed || !isActiveDbNamedTest) {
          throw new Error(`Safety Abort: Active database "${activeDbName}" rejected.`);
        }

        return true;
      };

      // Disallowed production / development database names
      expect(() => verifySafety("mongodb://localhost:27017/complaint_system_prod", "complaint_system_prod")).toThrow(/Safety Abort/);
      expect(() => verifySafety("mongodb://localhost:27017/complaint_system_dev", "complaint_system_dev")).toThrow(/Safety Abort/);
      expect(() => verifySafety("mongodb://localhost:27017/production_db", "production_db")).toThrow(/Safety Abort/);

      // Suffix without allowlist inclusion
      expect(() => verifySafety("mongodb://localhost:27017/arbitrary_app_test", "arbitrary_app_test")).toThrow(/Safety Abort/);

      // Substring trick (e.g., 'test' in the middle of a production db name)
      expect(() => verifySafety("mongodb://localhost:27017/my_test_production_db", "my_test_production_db")).toThrow(/Safety Abort/);

      // Permitted and verified database
      expect(verifySafety("mongodb://localhost:27017/complaint_system_category_tenant_test", "complaint_system_category_tenant_test")).toBe(true);
    });
  });
});
