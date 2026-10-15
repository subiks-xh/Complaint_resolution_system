const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Category = require("../../models/Category");
const Complaint = require("../../models/Complaint");
const Notification = require("../../models/Notification");
const { generateAccessToken } = require("../../config/jwt");
const notificationService = require("../../services/notificationService");
const sendEmailUtil = require("../../utils/sendEmail");

describe("Group 5: Notification Preferences Enforcement Integration Tests", () => {
  let orgA, orgB;
  let adminA, staffA1, userA1, userA2, userA_noPrefs;
  let adminB, userB1;
  let adminAToken, staffA1Token, userA1Token, userA2Token, userA_noPrefsToken;
  let adminBToken, userB1Token;
  let categoryA1;

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
      Complaint.deleteMany({ title: /Group 5 Notif Test/ }),
      Category.deleteMany({ name: /Group 5 Cat/ }),
      Notification.deleteMany({
        $or: [
          { title: /Group 5/ },
          { message: /Group 5/ },
          { title: /Test/ },
        ],
      }),
      User.deleteMany({ email: /@notif-prefs-test\.com$/ }),
      Organization.deleteMany({ code: /NOTIFPREF/ }),
    ]);
  };

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/complaint_system_test";

    const parsedPath = testDbUri
      .replace(/^mongodb(?:\+srv)?:\/\/[^\/]+\/?/, "")
      .split("?")[0];
    const uriDbName = parsedPath.trim();

    const isUriDbAllowed = ALLOWED_TEST_DBS.includes(uriDbName);
    const isUriDbNamedTest = TEST_DB_REGEX.test(uriDbName);

    if (!isUriDbAllowed || !isUriDbNamedTest) {
      throw new Error(
        `Safety Abort: TEST_MONGODB_URI database name "${uriDbName}" must be in ALLOWED_TEST_DBS and match test regex.`,
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
      await mongoose.connect(testDbUri, { serverSelectionTimeoutMS: 5000 });
    }

    await cleanupTestRecords();

    // Create Organizations
    orgA = await Organization.create({
      name: "Notif Pref Org Alpha",
      code: "NOTIFPREF-A",
      email: "org-alpha@notif-prefs-test.com",
    });

    orgB = await Organization.create({
      name: "Notif Pref Org Beta",
      code: "NOTIFPREF-B",
      email: "org-beta@notif-prefs-test.com",
    });

    // Create Users in Org A
    adminA = await User.create({
      name: "Admin Alpha",
      email: "admin-alpha@notif-prefs-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
      notificationPreferences: {
        inApp: true,
        email: true,
        complaintUpdates: true,
        escalationAlerts: true,
      },
    });

    staffA1 = await User.create({
      name: "Staff Alpha 1",
      email: "staff-alpha1@notif-prefs-test.com",
      password: "Password123!",
      role: "staff",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
      notificationPreferences: {
        inApp: true,
        email: true,
        complaintUpdates: true,
        escalationAlerts: true,
      },
    });

    userA1 = await User.create({
      name: "User Alpha 1",
      email: "user-alpha1@notif-prefs-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
      notificationPreferences: {
        inApp: true,
        email: true,
        complaintUpdates: true,
        escalationAlerts: true,
      },
    });

    userA2 = await User.create({
      name: "User Alpha 2",
      email: "user-alpha2@notif-prefs-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
      notificationPreferences: {
        inApp: false, // In-app disabled
        email: false, // Email disabled
        complaintUpdates: false,
        escalationAlerts: false,
      },
    });

    // Existing user with undefined notificationPreferences to test backward-compatible defaults
    userA_noPrefs = await User.create({
      name: "User Alpha No Prefs",
      email: "user-alpha-noprefs@notif-prefs-test.com",
      password: "Password123!",
      role: "user",
      organization: orgA._id,
      isActive: true,
      isOnboarded: true,
    });
    // Explicitly unset notificationPreferences to simulate legacy user
    await User.updateOne(
      { _id: userA_noPrefs._id },
      { $unset: { notificationPreferences: 1 } },
    );

    // Users in Org B
    adminB = await User.create({
      name: "Admin Beta",
      email: "admin-beta@notif-prefs-test.com",
      password: "Password123!",
      role: "org_admin",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
    });

    userB1 = await User.create({
      name: "User Beta 1",
      email: "user-beta1@notif-prefs-test.com",
      password: "Password123!",
      role: "user",
      organization: orgB._id,
      isActive: true,
      isOnboarded: true,
      notificationPreferences: {
        inApp: true,
        email: true,
        complaintUpdates: true,
        escalationAlerts: true,
      },
    });

    // Generate tokens
    adminAToken = generateAccessToken(adminA);
    staffA1Token = generateAccessToken(staffA1);
    userA1Token = generateAccessToken(userA1);
    userA2Token = generateAccessToken(userA2);
    userA_noPrefsToken = generateAccessToken(userA_noPrefs);
    adminBToken = generateAccessToken(adminB);
    userB1Token = generateAccessToken(userB1);

    // Category
    categoryA1 = await Category.create({
      name: "Group 5 Cat Billing",
      organization: orgA._id,
      isActive: true,
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

  describe("1. Notification Preferences API Endpoint Validation", () => {
    it("GET /api/users/notification-preferences returns user preferences", async () => {
      const res = await request(app)
        .get("/api/users/notification-preferences")
        .set("Authorization", `Bearer ${userA1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          inApp: true,
          email: true,
          complaintUpdates: true,
          escalationAlerts: true,
        }),
      );
    });

    it("GET /api/users/notification-preferences returns backward-compatible defaults for legacy users", async () => {
      const res = await request(app)
        .get("/api/users/notification-preferences")
        .set("Authorization", `Bearer ${userA_noPrefsToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          inApp: true,
          email: true,
          complaintUpdates: true,
          escalationAlerts: true,
        }),
      );
    });

    it("PUT /api/users/notification-preferences persists partial and full updates", async () => {
      const res = await request(app)
        .put("/api/users/notification-preferences")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          inApp: false,
          complaintUpdates: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inApp).toBe(false);
      expect(res.body.data.complaintUpdates).toBe(false);
      expect(res.body.data.email).toBe(true); // Preserved
      expect(res.body.data.escalationAlerts).toBe(true); // Preserved

      // Verify in DB
      const freshUser = await User.findById(userA1._id);
      expect(freshUser.notificationPreferences.inApp).toBe(false);
      expect(freshUser.notificationPreferences.complaintUpdates).toBe(false);
      expect(freshUser.notificationPreferences.email).toBe(true);

      // Restore userA1 for subsequent tests
      freshUser.notificationPreferences = {
        inApp: true,
        email: true,
        complaintUpdates: true,
        escalationAlerts: true,
      };
      await freshUser.save();
    });

    it("rejects unauthorized access (HTTP 401)", async () => {
      const res = await request(app).get("/api/users/notification-preferences");
      expect(res.status).toBe(401);
    });
  });

  describe("2. Centralized notificationService Preference Evaluation", () => {
    it("allows optional notifications when all preferences are true", async () => {
      const allowInApp = await notificationService.shouldSendInAppNotification(
        userA1._id,
        "complaint_submitted",
      );
      expect(allowInApp).toBe(true);

      const allowEmail = await notificationService.shouldSendEmailNotification(
        userA1._id,
        "complaint_updates",
      );
      expect(allowEmail).toBe(true);
    });

    it("suppresses optional in-app notifications when inApp is false", async () => {
      const allowInApp = await notificationService.shouldSendInAppNotification(
        userA2._id,
        "complaint_submitted",
      );
      expect(allowInApp).toBe(false);
    });

    it("suppresses optional email notifications when email is false", async () => {
      const allowEmail = await notificationService.shouldSendEmailNotification(
        userA2._id,
        "complaint_updates",
      );
      expect(allowEmail).toBe(false);
    });

    it("suppresses category-specific notifications when complaintUpdates is false", async () => {
      // User with inApp=true but complaintUpdates=false
      const partialUser = await User.create({
        name: "Partial Pref User",
        email: "partial-pref@notif-prefs-test.com",
        password: "Password123!",
        role: "user",
        organization: orgA._id,
        notificationPreferences: {
          inApp: true,
          email: true,
          complaintUpdates: false,
          escalationAlerts: true,
        },
      });

      const allowComplaintUpdate =
        await notificationService.shouldSendInAppNotification(
          partialUser._id,
          "status_change",
        );
      expect(allowComplaintUpdate).toBe(false);

      const allowEscalation =
        await notificationService.shouldSendInAppNotification(
          partialUser._id,
          "complaint_escalated",
        );
      expect(allowEscalation).toBe(true);
    });

    it("suppresses escalationAlerts when escalationAlerts is false but allows complaintUpdates", async () => {
      const escalationOffUser = await User.create({
        name: "Escalation Off User",
        email: "escalation-off@notif-prefs-test.com",
        password: "Password123!",
        role: "user",
        organization: orgA._id,
        notificationPreferences: {
          inApp: true,
          email: true,
          complaintUpdates: true,
          escalationAlerts: false,
        },
      });

      const allowComplaintUpdate =
        await notificationService.shouldSendInAppNotification(
          escalationOffUser._id,
          "complaint_assigned",
        );
      expect(allowComplaintUpdate).toBe(true);

      const allowEscalation =
        await notificationService.shouldSendInAppNotification(
          escalationOffUser._id,
          "complaint_escalated",
        );
      expect(allowEscalation).toBe(false);
    });
  });

  describe("3. Mandatory Security Notifications Policy", () => {
    it("ALWAYS delivers mandatory security notifications (account_update) even if inApp and email are false", async () => {
      // userA2 has all preferences false
      const allowSecurityInApp =
        await notificationService.shouldSendInAppNotification(
          userA2._id,
          "account_update",
        );
      expect(allowSecurityInApp).toBe(true);

      const allowSecurityEmail =
        await notificationService.shouldSendEmailNotification(
          userA2._id,
          "account_update",
        );
      expect(allowSecurityEmail).toBe(true);
    });

    it("creates an actual in-app notification for mandatory security events even when inApp=false", async () => {
      const notif = await notificationService.sendInAppNotification({
        recipient: userA2._id,
        title: "Group 5 Security Alert: Password Changed",
        message: "Your account credentials were updated.",
        type: "account_update",
      });

      expect(notif).toBeDefined();
      expect(notif.type).toBe("account_update");
      expect(notif.recipient.toString()).toBe(userA2._id.toString());

      // Confirm in DB
      const dbNotif = await Notification.findById(notif._id);
      expect(dbNotif).not.toBeNull();
    });
  });

  describe("4. End-to-End Workflow Preference Enforcement & Non-Interference", () => {
    it("delivers in-app notification when user has inApp=true and suppresses when inApp=false", async () => {
      // Send optional notification to userA1 (inApp: true)
      const notif1 = await notificationService.sendInAppNotification({
        recipient: userA1._id,
        title: "Group 5 Optional Status Update for A1",
        message: "Your complaint status has changed.",
        type: "status_change",
      });
      expect(notif1).not.toBeNull();
      expect(notif1.title).toBe("Group 5 Optional Status Update for A1");

      // Send optional notification to userA2 (inApp: false)
      const notif2 = await notificationService.sendInAppNotification({
        recipient: userA2._id,
        title: "Group 5 Optional Status Update for A2",
        message: "Your complaint status has changed.",
        type: "status_change",
      });
      expect(notif2).toBeNull();
    });

    it("user A2's disabled preferences do NOT suppress user A1's notifications", async () => {
      // User A2 has disabled inApp and email
      // Filtering bulk recipients [userA1._id, userA2._id] should preserve userA1 and drop userA2
      const recipients = [userA1._id, userA2._id];
      const eligible = await notificationService.filterRecipientsForInApp(
        recipients,
        "complaint_submitted",
      );

      expect(eligible.map((id) => id.toString())).toContain(
        userA1._id.toString(),
      );
      expect(eligible.map((id) => id.toString())).not.toContain(
        userA2._id.toString(),
      );
    });

    it("existing user without preferences receives default notifications", async () => {
      const notif = await notificationService.sendInAppNotification({
        recipient: userA_noPrefs._id,
        title: "Group 5 Default Notif for Legacy User",
        message: "Notification received via backward-compatible defaults.",
        type: "complaint_submitted",
      });

      expect(notif).not.toBeNull();
      expect(notif.recipient.toString()).toBe(userA_noPrefs._id.toString());
    });

    it("respects mock sendUserEmail when email is enabled and skips when disabled", async () => {
      let mockSenderCalled = false;
      const mockSender = jest.fn().mockImplementation(async () => {
        mockSenderCalled = true;
        return { success: true };
      });

      // User A1 has email: true
      const resultA1 = await notificationService.sendUserEmail(
        userA1,
        "complaint_updates",
        mockSender,
      );
      expect(resultA1.skipped).toBe(false);
      expect(resultA1.sent).toBe(true);
      expect(mockSender).toHaveBeenCalledTimes(1);

      mockSender.mockClear();

      // User A2 has email: false
      const resultA2 = await notificationService.sendUserEmail(
        userA2,
        "complaint_updates",
        mockSender,
      );
      expect(resultA2.skipped).toBe(true);
      expect(resultA2.sent).toBe(false);
      expect(mockSender).not.toHaveBeenCalled();
    });
  });

  describe("5. Workflow Resilience: Notification Failures Do Not Break Core Operations", () => {
    it("complaint creation succeeds even if notification dispatch throws an unexpected error", async () => {
      // Spy on sendInAppFromTemplate to simulate an unexpected error
      const sendSpy = jest
        .spyOn(notificationService, "sendInAppFromTemplate")
        .mockRejectedValueOnce(new Error("Simulated Notification Network Timeout"));

      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${userA1Token}`)
        .send({
          title: "Group 5 Notif Test Resilient Complaint Creation",
          description: "Detailed description of resilient complaint creation exceeding 20 characters.",
          category: categoryA1._id,
          priority: "medium",
        });

      sendSpy.mockRestore();

      // Complaint creation must succeed (HTTP 201) despite notification failure
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(
        "Group 5 Notif Test Resilient Complaint Creation",
      );
    });

    it("staff status update succeeds even if email dispatch fails", async () => {
      // Create a test complaint
      const complaint = await Complaint.create({
        title: "Group 5 Notif Test Staff Update Resilience",
        description: "Detailed description of complaint to test staff update resilience exceeding 20 chars.",
        category: categoryA1._id,
        priority: "medium",
        user: userA1._id,
        organization: orgA._id,
        assignedTo: staffA1._id,
        status: "assigned",
      });

      // Spy on sendUserEmail to simulate an error
      const emailSpy = jest
        .spyOn(notificationService, "sendUserEmail")
        .mockRejectedValueOnce(new Error("SMTP Connection Refused"));

      const res = await request(app)
        .put(`/api/staff/complaints/${complaint._id}/status`)
        .set("Authorization", `Bearer ${staffA1Token}`)
        .send({
          status: "in-progress",
          remarks: "Staff began working on the issue.",
        });

      emailSpy.mockRestore();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("in-progress");
    });
  });

  describe("6. Cross-Organization Notification Boundary Isolation", () => {
    it("admin in Org A cannot view notifications belonging to users in Org B", async () => {
      // Create notification for user in Org B
      const notifB = await Notification.create({
        recipient: userB1._id,
        title: "Group 5 Org B Notification",
        message: "Message for user in Organization B.",
        type: "complaint_submitted",
      });

      // Admin A queries notifications
      const res = await request(app)
        .get(`/api/notifications/${notifB._id}`)
        .set("Authorization", `Bearer ${adminAToken}`);

      // Must be 404 or 403 (cannot access foreign notification)
      expect([403, 404]).toContain(res.status);
    });
  });
});
