const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const EscalationRule = require("../../models/EscalationRule");
const Notification = require("../../models/Notification");
const { generateAccessToken } = require("../../config/jwt");
const { runEscalationCycle, executeEscalation, evaluateRuleConditions } = require("../../utils/escalationEngine");
const { checkAndEscalateComplaints } = require("../../utils/escalationScheduler");

describe("Escalation Engine and Scheduler Repair Integration Tests (Group 3)", () => {
  let orgA, orgB;
  let adminA, staffA1, userA;
  let adminB, staffB1, userB;
  let superAdmin;
  let adminAToken, adminBToken, superAdminToken;
  let categoryA, categoryB;

  const ALLOWED_TEST_DBS = [
    "complaint_system_assignment_test",
    "complaint_system_category_tenant_test",
    "complaint_system_complaint_tenant_test",
    "complaint_system_analytics_feedback_tenant_test",
    "complaint_system_admin_actions_staff_tenant_test",
    "complaint_system_escalation_engine_test",
    "complaint_system_test",
    "complaint_resolution_test",
  ];
  const TEST_DB_REGEX = /(?:_test|test_|-test|test-)$/i;

  const cleanupTestRecords = async () => {
    await Promise.all([
      Notification.deleteMany({
        $or: [
          { message: /Group 3 Escalation Engine/ },
          { title: /Escalation/ },
          { title: /SLA Breach/ },
        ],
      }),
      EscalationRule.deleteMany({ name: /Group 3/ }),
      Complaint.deleteMany({ $or: [{ title: /Group 3/ }, { title: /Good Complaint/ }] }),
      Category.deleteMany({ name: /Group 3/ }),
      User.deleteMany({ email: /@escalation-engine-test\.com$/ }),
      Organization.deleteMany({ code: /G3ESC/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_escalation_engine_test";

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

    // 1. Create Organizations
    orgA = await Organization.create({
      name: "Org A Escalation",
      code: "G3ESC-ORGA",
      email: "admin@orga.escalation-engine-test.com",
      status: "active",
    });

    orgB = await Organization.create({
      name: "Org B Escalation",
      code: "G3ESC-ORGB",
      email: "admin@orgb.escalation-engine-test.com",
      status: "active",
    });

    // 2. Create Users
    adminA = await User.create({
      name: "Admin Org A",
      email: "admin.a@escalation-engine-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      emailVerified: true,
    });

    staffA1 = await User.create({
      name: "Staff 1 Org A",
      email: "staff.a1@escalation-engine-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      department: "Technical",
      isActive: true,
      emailVerified: true,
    });

    userA = await User.create({
      name: "User Org A",
      email: "user.a@escalation-engine-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      emailVerified: true,
    });

    adminB = await User.create({
      name: "Admin Org B",
      email: "admin.b@escalation-engine-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      emailVerified: true,
    });

    staffB1 = await User.create({
      name: "Staff 1 Org B",
      email: "staff.b1@escalation-engine-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgB._id,
      department: "Operations",
      isActive: true,
      emailVerified: true,
    });

    userB = await User.create({
      name: "User Org B",
      email: "user.b@escalation-engine-test.com",
      password: "Password123!",
      role: "user",
      organization: orgB._id,
      isActive: true,
      emailVerified: true,
    });

    superAdmin = await User.create({
      name: "Super Admin",
      email: "superadmin@escalation-engine-test.com",
      password: "Password123!",
      role: "super_admin",
      organization: null,
      isActive: true,
      emailVerified: true,
    });

    adminAToken = generateAccessToken(adminA);
    adminBToken = generateAccessToken(adminB);
    superAdminToken = generateAccessToken(superAdmin);

    // 3. Create Categories
    categoryA = await Category.create({
      name: "Group 3 Test Cat A",
      organization: orgA._id,
      isActive: true,
    });

    categoryB = await Category.create({
      name: "Group 3 Test Cat B",
      organization: orgB._id,
      isActive: true,
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

  describe("1. Rule Execution & Status Enum Compliance", () => {
    it("executes an enabled rule against an eligible in-progress complaint", async () => {
      // Create enabled rule for Org A
      const rule = await EscalationRule.create({
        name: "Group 3 Test Rule High Priority Overdue",
        organization: orgA._id,
        category: categoryA._id,
        priority: "high",
        conditions: {
          timeThreshold: 24,
          responseThreshold: 48,
          noUpdateThreshold: 12,
        },
        actions: {
          increasePriority: true,
          sendNotification: true,
        },
        isActive: true,
        createdBy: adminA._id,
      });

      // Create complaint created 30 hours ago, status 'in-progress'
      const simulatedNow = new Date("2026-10-15T12:00:00Z");
      const thirtyHoursAgo = new Date(simulatedNow.getTime() - 30 * 60 * 60 * 1000);

      const complaint = await Complaint.create({
        title: "Group 3 Escalation Eligible Complaint",
        description: "Testing rule condition matching for in-progress complaint",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "in-progress",
        priority: "high",
        assignedTo: staffA1._id,
        createdAt: thirtyHoursAgo,
        updatedAt: thirtyHoursAgo,
        timeline: {
          submittedAt: thirtyHoursAgo,
          assignedAt: thirtyHoursAgo,
          lastUpdatedAt: thirtyHoursAgo,
        },
      });

      const cycleResult = await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      expect(cycleResult.escalatedCount).toBeGreaterThanOrEqual(1);

      // Verify complaint was mutated correctly
      const updated = await Complaint.findById(complaint._id);
      expect(updated.status).toBe("escalated");
      expect(updated.priority).toBe("critical"); // priority increased from high -> critical
      expect(updated.escalationLevel).toBe(1);
      expect(updated.escalationHistory.length).toBe(1);
      expect(updated.escalationHistory[0].escalationType).toBe("auto");
      expect(updated.statusHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "escalated",
            changedByRole: "system",
          }),
        ]),
      );

      // Clean up rule so it doesn't match in other tests
      await EscalationRule.findByIdAndDelete(rule._id);
    });

    it("does not escalate when conditions are not yet breached", async () => {
      const simulatedNow = new Date("2026-10-15T12:00:00Z");
      const twoHoursAgo = new Date(simulatedNow.getTime() - 2 * 60 * 60 * 1000);

      const complaint = await Complaint.create({
        title: "Group 3 Escalation Fresh Complaint",
        description: "Complaint created recently that must not escalate",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "in-progress",
        priority: "high",
        assignedTo: staffA1._id,
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
        timeline: {
          submittedAt: twoHoursAgo,
          lastUpdatedAt: twoHoursAgo,
        },
      });

      const cycleResult = await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      const updated = await Complaint.findById(complaint._id);
      expect(updated.status).toBe("in-progress");
      expect(updated.escalationLevel).toBe(0);
    });

    it("does not execute disabled escalation rules", async () => {
      // Inactive rule
      await EscalationRule.create({
        name: "Group 3 Test Rule Disabled",
        organization: orgA._id,
        priority: "low",
        conditions: { timeThreshold: 5 },
        actions: { increasePriority: true },
        isActive: false,
        createdBy: adminA._id,
      });

      const simulatedNow = new Date("2026-10-15T12:00:00Z");
      const tenHoursAgo = new Date(simulatedNow.getTime() - 10 * 60 * 60 * 1000);

      const complaint = await Complaint.create({
        title: "Group 3 Escalation Low Priority With Inactive Rule",
        description: "Complaint that should not be touched by inactive rule",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "low",
        createdAt: tenHoursAgo,
        updatedAt: tenHoursAgo,
        timeline: { lastUpdatedAt: tenHoursAgo },
      });

      await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      const updated = await Complaint.findById(complaint._id);
      expect(updated.status).toBe("assigned");
      expect(updated.escalationLevel).toBe(0);
    });

    it("never escalates resolved or closed complaints", async () => {
      const simulatedNow = new Date("2026-10-15T12:00:00Z");
      const longAgo = new Date(simulatedNow.getTime() - 100 * 60 * 60 * 1000);

      const resolvedComplaint = await Complaint.create({
        title: "Group 3 Escalation Resolved Complaint",
        description: "Resolved complaint long past threshold",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "resolved",
        priority: "high",
        createdAt: longAgo,
        updatedAt: longAgo,
        timeline: { lastUpdatedAt: longAgo, resolvedAt: longAgo },
      });

      const closedComplaint = await Complaint.create({
        title: "Group 3 Escalation Closed Complaint",
        description: "Closed complaint long past threshold",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "closed",
        priority: "high",
        createdAt: longAgo,
        updatedAt: longAgo,
        timeline: { lastUpdatedAt: longAgo, closedAt: longAgo },
      });

      await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      const checkResolved = await Complaint.findById(resolvedComplaint._id);
      expect(checkResolved.status).toBe("resolved");
      expect(checkResolved.escalationLevel).toBe(0);

      const checkClosed = await Complaint.findById(closedComplaint._id);
      expect(checkClosed.status).toBe("closed");
      expect(checkClosed.escalationLevel).toBe(0);
    });
  });

  describe("2. Scheduler & Manual Endpoint Unification", () => {
    it("scheduler checkAndEscalateComplaints executes the unified engine without manual API invocation", async () => {
      const pastDeadline = new Date(Date.now() - 5 * 60 * 60 * 1000);

      // Create an overdue complaint with auto-escalate SLA breach
      const overdueComplaint = await Complaint.create({
        title: "Group 3 Escalation Scheduler Overdue Complaint",
        description: "Overdue complaint to verify scheduler execution",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "medium",
        assignedTo: staffA1._id,
        resolutionDeadline: pastDeadline,
        createdAt: pastDeadline,
        updatedAt: pastDeadline,
        timeline: {
          submittedAt: pastDeadline,
          assignedAt: pastDeadline,
          lastUpdatedAt: pastDeadline,
        },
      });

      // Invoke scheduler's core checkAndEscalateComplaints method directly
      const schedulerResult = await checkAndEscalateComplaints();

      expect(schedulerResult).toBeDefined();
      expect(typeof schedulerResult.processedCount).toBe("number");

      // Verify the complaint has been escalated
      const updated = await Complaint.findById(overdueComplaint._id);
      expect(updated.slaBreached).toBe(true);
      expect(updated.status).toBe("escalated");
      expect(updated.escalationLevel).toBe(1);
    });

    it("manual endpoint (/api/admin/escalation-rules/process) reuses the same unified engine", async () => {
      const res = await request(app)
        .post("/api/admin/escalation-rules/process")
        .set("Authorization", `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.processedCount).toBe("number");
      expect(typeof res.body.data.escalatedCount).toBe("number");
    });

    it("ensures repeated execution is idempotent (no duplicate levels or notifications)", async () => {
      const simulatedNow = new Date("2026-10-17T12:00:00Z");
      const overdueTime = new Date(simulatedNow.getTime() - 50 * 60 * 60 * 1000);

      const complaint = await Complaint.create({
        title: "Group 3 Escalation Idempotency Test Complaint",
        description: "Checking that running multiple times doesn't spam levels",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "high",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: { lastUpdatedAt: overdueTime },
      });

      // Run 1
      await runEscalationCycle({ organizationId: orgA._id, now: simulatedNow });
      const afterRun1 = await Complaint.findById(complaint._id);
      expect(afterRun1.escalationLevel).toBe(1);
      const historyCountRun1 = afterRun1.escalationHistory.length;

      // Run 2 immediately at the same simulated time
      await runEscalationCycle({ organizationId: orgA._id, now: simulatedNow });
      const afterRun2 = await Complaint.findById(complaint._id);
      expect(afterRun2.escalationLevel).toBe(1); // Must remain at level 1, NOT incremented to 2
      expect(afterRun2.escalationHistory.length).toBe(historyCountRun1);
    });

    it("proves a complaint matching a configured rule is NOT escalated a second time by the SLA phase in one run", async () => {
      const simulatedNow = new Date("2026-10-18T10:00:00Z");
      const overdueTime = new Date(simulatedNow.getTime() - 60 * 60 * 1000); // 1 hour overdue

      // Active rule matching high priority
      const highRule = await EscalationRule.create({
        name: "Group 3 Rule For Both Phases Test",
        organization: orgA._id,
        category: categoryA._id,
        priority: "high",
        isActive: true,
        conditions: { timeThreshold: 1, responseThreshold: 2, noUpdateThreshold: 1 },
        actions: { sendNotification: true, autoAssign: false },
        createdBy: adminA._id,
      });

      // Complaint that matches rule AND has passed resolutionDeadline
      const dualEligibleComplaint = await Complaint.create({
        title: "Group 3 Dual Phase Escalation Safety Complaint",
        description: "Eligible for both Phase A and Phase B",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "in-progress",
        priority: "high",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: {
          submittedAt: overdueTime,
          assignedAt: overdueTime,
          firstResponseAt: overdueTime,
          lastUpdatedAt: overdueTime,
        },
      });

      // Execute single cycle
      const cycleResult = await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      const updated = await Complaint.findById(dualEligibleComplaint._id);
      // It must be escalated exactly once to level 1, NOT level 2
      expect(updated.escalationLevel).toBe(1);
      expect(updated.status).toBe("escalated");
      expect(updated.escalationHistory.length).toBe(1);
      expect(updated.escalationHistory[0].reason).toMatch(/EscalationRule/);

      // Clean up rule
      await EscalationRule.findByIdAndDelete(highRule._id);
    });

    it("allows a legitimate later escalation step even if its reason description matches an earlier step", async () => {
      const t0 = new Date("2026-10-19T08:00:00Z");
      const overdueTime = new Date(t0.getTime() - 48 * 60 * 60 * 1000);

      const complaint = await Complaint.create({
        title: "Group 3 Multi-Step Progression Complaint",
        description: "Checking progressive escalation steps with same reason",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "medium",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: { lastUpdatedAt: overdueTime },
      });

      // First step: SLA breach at t0
      const reason = "SLA resolution deadline breached - automatic escalation";
      const step1 = await executeEscalation(complaint, { reason, now: t0 });
      expect(step1.executed).toBe(true);
      expect(complaint.escalationLevel).toBe(1);

      // Re-assignment or staff interaction leaves it in progress, still past deadline
      complaint.status = "in-progress";
      await complaint.save();

      // Later step: at t0 + 2 hours (outside cooldown window), a subsequent escalation step is evaluated
      const t1 = new Date(t0.getTime() + 2 * 60 * 60 * 1000);
      const step2 = await executeEscalation(complaint, { reason, now: t1 });
      expect(step2.executed).toBe(true);
      expect(complaint.escalationLevel).toBe(2);
      expect(complaint.escalationHistory.length).toBe(2);
      expect(complaint.escalationHistory[1].escalationLevel).toBe(2);
    });

    it("verifies reopened complaints reset SLA state and can legitimately escalate when re-breached", async () => {
      const t0 = new Date("2026-10-20T08:00:00Z");
      const pastDeadline = new Date(t0.getTime() - 10 * 60 * 60 * 1000);

      // 1. Complaint originally resolved
      const complaint = await Complaint.create({
        title: "Group 3 Reopened Complaint Continuation Test",
        description: "Testing reopened complaint lifecycle",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "resolved",
        priority: "high",
        assignedTo: staffA1._id,
        resolutionDeadline: pastDeadline,
        createdAt: pastDeadline,
        updatedAt: pastDeadline,
        timeline: {
          submittedAt: pastDeadline,
          resolvedAt: new Date(t0.getTime() - 2 * 60 * 60 * 1000),
          lastUpdatedAt: t0,
        },
      });

      // Cycle at t0: resolved complaint is NOT escalated
      await runEscalationCycle({ organizationId: orgA._id, now: t0 });
      let freshDoc = await Complaint.findById(complaint._id);
      expect(freshDoc.status).toBe("resolved");
      expect(freshDoc.escalationLevel).toBe(0);

      // 2. User reopens the complaint with new 24h SLA deadline
      freshDoc.status = "reopened";
      freshDoc.reopenCount = 1;
      freshDoc.slaBreached = false;
      freshDoc.timeline = freshDoc.timeline || {};
      freshDoc.timeline.reopenedAt = t0;
      freshDoc.timeline.lastUpdatedAt = t0;
      const newDeadline = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
      freshDoc.resolutionDeadline = newDeadline;
      await freshDoc.save();

      // Cycle during active reopened window (t0 + 10 hours): not breached
      const tDuringSLA = new Date(t0.getTime() + 10 * 60 * 60 * 1000);
      await runEscalationCycle({ organizationId: orgA._id, now: tDuringSLA });
      freshDoc = await Complaint.findById(complaint._id);
      expect(freshDoc.status).toBe("reopened");
      expect(freshDoc.escalationLevel).toBe(0);

      // Cycle after reopened deadline breaches (t0 + 26 hours): automatically escalates
      const tAfterBreach = new Date(t0.getTime() + 26 * 60 * 60 * 1000);
      await runEscalationCycle({ organizationId: orgA._id, now: tAfterBreach });
      freshDoc = await Complaint.findById(complaint._id);
      expect(freshDoc.status).toBe("escalated");
      expect(freshDoc.slaBreached).toBe(true);
      expect(freshDoc.escalationLevel).toBe(1);
    });
  });

  describe("3. Tenant Isolation & Super Admin Global Handling", () => {
    it("ensures Organization A's rules do NOT process Organization B's complaints", async () => {
      // Create rule strictly for Org A
      await EscalationRule.create({
        name: "Group 3 Test Rule Org A Only",
        organization: orgA._id,
        priority: "medium",
        conditions: { timeThreshold: 5 },
        actions: { increasePriority: true },
        isActive: true,
        createdBy: adminA._id,
      });

      // Create complaint for Org B that matches priority and threshold
      const simulatedNow = new Date("2026-10-18T12:00:00Z");
      const oldTime = new Date(simulatedNow.getTime() - 20 * 60 * 60 * 1000);

      const complaintB = await Complaint.create({
        title: "Group 3 Escalation Org B Isolated Complaint",
        description: "Org B complaint that should not be touched by Org A rules",
        organization: orgB._id,
        category: categoryB._id,
        user: userB._id,
        status: "assigned",
        priority: "medium",
        assignedTo: staffB1._id,
        createdAt: oldTime,
        updatedAt: oldTime,
        timeline: { lastUpdatedAt: oldTime },
      });

      // Run escalation cycle for Org A only
      await runEscalationCycle({ organizationId: orgA._id, now: simulatedNow });

      // Org B complaint must be untouched
      const checkB = await Complaint.findById(complaintB._id);
      expect(checkB.status).toBe("assigned");
      expect(checkB.escalationLevel).toBe(0);

      // Clean up rule
      await EscalationRule.deleteMany({ name: "Group 3 Test Rule Org A Only" });
    });

    it("notifies only the intended organization admins during automatic escalation", async () => {
      // Clear notifications
      await Notification.deleteMany({});

      const simulatedNow = new Date("2026-10-19T12:00:00Z");
      const oldTime = new Date(simulatedNow.getTime() - 30 * 60 * 60 * 1000);

      const overdueDeadline = new Date(simulatedNow.getTime() - 10 * 60 * 60 * 1000);

      const complaintA = await Complaint.create({
        title: "Group 3 Escalation Notification Tenant Scope",
        description: "Checking notification recipients during auto-escalation",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "high",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueDeadline,
        createdAt: oldTime,
        updatedAt: oldTime,
        timeline: { lastUpdatedAt: oldTime },
      });

      await runEscalationCycle({ organizationId: orgA._id, now: simulatedNow });

      const notifications = await Notification.find({
        relatedComplaint: complaintA._id,
      });

      const recipientIds = notifications.map((n) => n.recipient.toString());

      // Org Admin A should be notified
      expect(recipientIds).toContain(adminA._id.toString());
      // Super Admin should be notified
      expect(recipientIds).toContain(superAdmin._id.toString());
      // Org Admin B must NEVER be notified
      expect(recipientIds).not.toContain(adminB._id.toString());
    });
  });

  describe("4. Administrative Rule Management Tenant Scoping", () => {
    it("allows Org Admin A to create an escalation rule in Org A", async () => {
      const res = await request(app)
        .post("/api/admin/escalation-rules")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          name: "Group 3 Test Rule Created By Admin A",
          priority: "medium",
          category: categoryA._id.toString(),
          conditions: {
            timeThreshold: 24,
            responseThreshold: 48,
            noUpdateThreshold: 12,
          },
          actions: {
            increasePriority: false,
            sendNotification: true,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.toString()).toBe(orgA._id.toString());

      // Clean up rule
      await EscalationRule.findByIdAndDelete(res.body.data._id);
    });

    it("rejects Org Admin A referencing category belonging to Org B", async () => {
      const res = await request(app)
        .post("/api/admin/escalation-rules")
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({
          name: "Group 3 Test Rule Foreign Category Attempt",
          priority: "medium",
          category: categoryB._id.toString(), // Belongs to Org B!
          conditions: {
            timeThreshold: 24,
          },
          actions: {
            sendNotification: true,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Category not found in target organization/i);
    });

    it("Super Admin can view escalated complaints globally and filter by organization", async () => {
      const resGlobal = await request(app)
        .get("/api/admin/complaints/escalated")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(resGlobal.status).toBe(200);
      expect(resGlobal.body.success).toBe(true);
      expect(Array.isArray(resGlobal.body.data.complaints)).toBe(true);

      const resFiltered = await request(app)
        .get(`/api/admin/complaints/escalated?organization=${orgA._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(resFiltered.status).toBe(200);
      expect(resFiltered.body.success).toBe(true);
      const orgIds = resFiltered.body.data.complaints.map((c) => c.organization.toString());
      orgIds.forEach((id) => expect(id).toBe(orgA._id.toString()));
    });

    it("verifies complaint without custom rule still follows category-level SLA behavior (and respects autoEscalate=false)", async () => {
      const simulatedNow = new Date("2026-10-21T10:00:00Z");
      const overdueTime = new Date(simulatedNow.getTime() - 20 * 60 * 60 * 1000);

      // Create a category with autoEscalate disabled
      const catDisabled = await Category.create({
        name: `Group 3 Cat Disabled ${Date.now()}`,
        organization: orgA._id,
        isActive: true,
        escalationConfig: {
          enabled: true,
          autoEscalate: false,
        },
      });

      const complaintNoEscalate = await Complaint.create({
        title: "Group 3 Complaint Under AutoEscalate Disabled Category",
        description: "Should have slaBreached marked but not status=escalated",
        organization: orgA._id,
        category: catDisabled._id,
        user: userA._id,
        status: "assigned",
        priority: "medium",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: { lastUpdatedAt: overdueTime },
      });

      await runEscalationCycle({ organizationId: orgA._id, now: simulatedNow });

      const check = await Complaint.findById(complaintNoEscalate._id);
      expect(check.slaBreached).toBe(true);
      expect(check.status).toBe("assigned"); // Not escalated because autoEscalate is false
      expect(check.escalationLevel).toBe(0);
    });

    it("demonstrates fault isolation: an individual complaint failure does not prevent processing of other complaints", async () => {
      const simulatedNow = new Date("2026-10-22T10:00:00Z");
      const overdueTime = new Date(simulatedNow.getTime() - 10 * 60 * 60 * 1000);

      // Good complaint 1
      const goodComplaint1 = await Complaint.create({
        title: "Good Complaint 1",
        description: "Should be processed successfully",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "medium",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: { lastUpdatedAt: overdueTime },
      });

      // Good complaint 2
      const goodComplaint2 = await Complaint.create({
        title: "Good Complaint 2",
        description: "Should also be processed successfully despite any peer failures",
        organization: orgA._id,
        category: categoryA._id,
        user: userA._id,
        status: "assigned",
        priority: "high",
        assignedTo: staffA1._id,
        resolutionDeadline: overdueTime,
        createdAt: overdueTime,
        updatedAt: overdueTime,
        timeline: { lastUpdatedAt: overdueTime },
      });

      const cycleResult = await runEscalationCycle({
        organizationId: orgA._id,
        now: simulatedNow,
      });

      expect(cycleResult.processedCount).toBeGreaterThanOrEqual(2);

      const check1 = await Complaint.findById(goodComplaint1._id);
      const check2 = await Complaint.findById(goodComplaint2._id);
      expect(check1.status).toBe("escalated");
      expect(check2.status).toBe("escalated");
    });
  });

  describe("5. Test Database Safety Guard", () => {
    it("strictly verifies that test database names are on the allowlist and match regex", () => {
      const verifySafety = (uri, activeName) => {
        const parsedPath = uri
          .replace(/^mongodb(?:\+srv)?:\/\/[^\/]+\/?/, "")
          .split("?")[0];
        const uriDbName = parsedPath.trim();

        const isUriDbAllowed = ALLOWED_TEST_DBS.includes(uriDbName);
        const isUriDbNamedTest = TEST_DB_REGEX.test(uriDbName);
        if (!isUriDbAllowed || !isUriDbNamedTest) {
          throw new Error(`Safety Abort: URI database "${uriDbName}" rejected.`);
        }

        const isActiveDbAllowed = ALLOWED_TEST_DBS.includes(activeName);
        const isActiveDbNamedTest = TEST_DB_REGEX.test(activeName);
        if (!isActiveDbAllowed || !isActiveDbNamedTest) {
          throw new Error(`Safety Abort: Active database "${activeName}" rejected.`);
        }

        return true;
      };

      // Disallowed production / development database names
      expect(() =>
        verifySafety("mongodb://localhost:27017/complaint_system_prod", "complaint_system_prod"),
      ).toThrow(/Safety Abort/);
      expect(() =>
        verifySafety("mongodb://localhost:27017/complaint_system_dev", "complaint_system_dev"),
      ).toThrow(/Safety Abort/);
      expect(() =>
        verifySafety("mongodb://localhost:27017/production_db", "production_db"),
      ).toThrow(/Safety Abort/);

      // Suffix without allowlist inclusion
      expect(() =>
        verifySafety("mongodb://localhost:27017/arbitrary_app_test", "arbitrary_app_test"),
      ).toThrow(/Safety Abort/);

      // Substring trick (e.g., 'test' in the middle of a production db name)
      expect(() =>
        verifySafety("mongodb://localhost:27017/my_test_production_db", "my_test_production_db"),
      ).toThrow(/Safety Abort/);

      // Permitted and verified database
      expect(
        verifySafety(
          "mongodb://localhost:27017/complaint_system_escalation_engine_test",
          "complaint_system_escalation_engine_test",
        ),
      ).toBe(true);
    });
  });
});
