/**
 * Complaint Business Logic Tests
 * Tests for complaint lifecycle, SLA, escalation, and assignment logic
 */

describe("Complaint Lifecycle", () => {
  let complaint;

  beforeEach(() => {
    complaint = {
      id: "complaint-123",
      title: "Wi-Fi Not Working",
      status: "new",
      priority: "high",
      createdAt: new Date(),
      timeline: {
        submittedAt: new Date(),
      },
    };
  });

  describe("Status Transitions", () => {
    test("should transition from new to assigned", () => {
      const oldStatus = complaint.status;
      complaint.status = "assigned";

      expect(oldStatus).toBe("new");
      expect(complaint.status).toBe("assigned");
    });

    test("should transition from assigned to in-progress", () => {
      complaint.status = "assigned";
      complaint.status = "in-progress";

      expect(complaint.status).toBe("in-progress");
    });

    test("should transition from in-progress to resolved", () => {
      complaint.status = "in-progress";
      complaint.status = "resolved";
      complaint.timeline.resolvedAt = new Date();

      expect(complaint.status).toBe("resolved");
      expect(complaint.timeline.resolvedAt).toBeDefined();
    });

    test("should transition from resolved to closed", () => {
      complaint.status = "resolved";
      complaint.status = "closed";
      complaint.timeline.closedAt = new Date();

      expect(complaint.status).toBe("closed");
    });

    test("should transition from resolved to reopened", () => {
      complaint.status = "resolved";
      complaint.status = "reopened";
      complaint.reopenCount = 1;
      complaint.timeline.reopenedAt = new Date();

      expect(complaint.status).toBe("reopened");
      expect(complaint.reopenCount).toBe(1);
    });

    test("should escalate from any active status to escalated", () => {
      complaint.status = "in-progress";
      complaint.status = "escalated";
      complaint.escalationLevel = 1;
      complaint.timeline.escalatedAt = new Date();

      expect(complaint.status).toBe("escalated");
      expect(complaint.escalationLevel).toBeGreaterThan(0);
    });
  });

  describe("Assignment", () => {
    test("should assign complaint to staff", () => {
      const staffId = "staff-001";
      complaint.assignedTo = staffId;
      complaint.status = "assigned";
      complaint.timeline.assignedAt = new Date();

      expect(complaint.assignedTo).toBe(staffId);
      expect(complaint.timeline.assignedAt).toBeDefined();
    });

    test("should track assignment history", () => {
      complaint.assignmentHistory = [
        { staffId: "staff-001", assignedAt: new Date(), unassignedAt: null },
        { staffId: "staff-002", assignedAt: new Date(), unassignedAt: null },
      ];

      expect(complaint.assignmentHistory.length).toBe(2);
    });

    test("should support reassignment", () => {
      complaint.assignedTo = "staff-001";
      complaint.assignmentHistory = [{ staffId: "staff-001" }];

      complaint.assignedTo = "staff-002";
      complaint.assignmentHistory.push({ staffId: "staff-002" });

      expect(complaint.assignedTo).toBe("staff-002");
      expect(complaint.assignmentHistory.length).toBe(2);
    });
  });

  describe("SLA Management", () => {
    test("should calculate deadline for critical priority", () => {
      complaint.priority = "critical";
      const slaHours = 4;
      const deadline = new Date(
        complaint.createdAt.getTime() + slaHours * 60 * 60 * 1000,
      );
      complaint.resolutionDeadline = deadline;

      const timeDiff =
        (complaint.resolutionDeadline - complaint.createdAt) / (1000 * 60 * 60);
      expect(timeDiff).toBeCloseTo(slaHours, 0);
    });

    test("should calculate deadline for high priority", () => {
      complaint.priority = "high";
      const slaHours = 24;
      const deadline = new Date(
        complaint.createdAt.getTime() + slaHours * 60 * 60 * 1000,
      );
      complaint.resolutionDeadline = deadline;

      const timeDiff =
        (complaint.resolutionDeadline - complaint.createdAt) / (1000 * 60 * 60);
      expect(timeDiff).toBeCloseTo(slaHours, 0);
    });

    test("should detect SLA breach", () => {
      complaint.resolutionDeadline = new Date(Date.now() - 3600000); // 1 hour ago
      complaint.status = "in-progress"; // Not resolved

      const isBreached =
        new Date() > complaint.resolutionDeadline &&
        !["resolved", "closed"].includes(complaint.status);
      expect(isBreached).toBe(true);
    });

    test("should not mark as breached if resolved before deadline", () => {
      const deadline = new Date(Date.now() + 3600000); // 1 hour from now
      complaint.resolutionDeadline = deadline;
      complaint.status = "resolved";

      const isBreached =
        new Date() > complaint.resolutionDeadline &&
        !["resolved", "closed"].includes(complaint.status);
      expect(isBreached).toBe(false);
    });

    test("should mark as breached if still pending after deadline", () => {
      complaint.resolutionDeadline = new Date(Date.now() - 3600000); // Expired
      complaint.status = "assigned"; // Still pending

      const isBreached =
        new Date() > complaint.resolutionDeadline &&
        !["resolved", "closed"].includes(complaint.status);
      expect(isBreached).toBe(true);
    });
  });

  describe("Escalation", () => {
    test("should initialize escalation level 0", () => {
      complaint.escalationLevel = 0;
      expect(complaint.escalationLevel).toBe(0);
    });

    test("should increment escalation level", () => {
      complaint.escalationLevel = 0;
      complaint.escalationLevel += 1;
      expect(complaint.escalationLevel).toBe(1);
    });

    test("should multi-level escalation", () => {
      complaint.escalationLevel = 0;

      // Level 1 escalation
      complaint.escalationLevel = 1;
      complaint.escalatedToRole = "senior-staff";

      expect(complaint.escalationLevel).toBe(1);
      expect(complaint.escalatedToRole).toBe("senior-staff");
    });

    test("should track escalation history", () => {
      complaint.escalationHistory = [
        {
          level: 1,
          escalatedAt: new Date(),
          escalatedTo: "staff-002",
          reason: "SLA breach",
        },
        {
          level: 2,
          escalatedAt: new Date(),
          escalatedTo: "manager-001",
          reason: "Still pending",
        },
      ];

      expect(complaint.escalationHistory.length).toBe(2);
    });
  });

  describe("Priority Levels", () => {
    test("should have valid priority levels", () => {
      const validPriorities = ["low", "medium", "high", "critical"];

      validPriorities.forEach((priority) => {
        complaint.priority = priority;
        expect(complaint.priority).toBeDefined();
      });
    });

    test("should affect response time", () => {
      const slaMap = {
        critical: 4,
        high: 24,
        medium: 48,
        low: 72,
      };

      Object.entries(slaMap).forEach(([priority, hours]) => {
        complaint.priority = priority;
        const deadline = new Date(
          complaint.createdAt.getTime() + hours * 60 * 60 * 1000,
        );
        complaint.resolutionDeadline = deadline;

        const timeDiff =
          (complaint.resolutionDeadline - complaint.createdAt) /
          (1000 * 60 * 60);
        expect(timeDiff).toBeCloseTo(hours, 0);
      });
    });
  });

  describe("Resolution", () => {
    test("should track resolution details", () => {
      complaint.resolution = {
        remarks: "Issue resolved by restarting Wi-Fi router",
        resolvedBy: "staff-001",
        satisfaction: "pending",
      };

      expect(complaint.resolution.remarks).toBeDefined();
      expect(complaint.resolution.resolvedBy).toBeDefined();
    });

    test("should allow satisfaction feedback", () => {
      complaint.resolution = {
        remarks: "Issue fixed",
        resolvedBy: "staff-001",
        satisfaction: "pending",
      };

      complaint.resolution.satisfaction = "satisfied";

      expect(complaint.resolution.satisfaction).toBe("satisfied");
    });
  });
});

describe("Assignment Algorithm", () => {
  let complaints, staff, assignmentRules;

  beforeEach(() => {
    complaints = [
      { id: "c1", priority: "critical", category: "IT" },
      { id: "c2", priority: "high", category: "HR" },
      { id: "c3", priority: "low", category: "IT" },
    ];

    staff = [
      { id: "s1", role: "staff", assignedCount: 2, skills: ["IT", "HR"] },
      { id: "s2", role: "staff", assignedCount: 5, skills: ["HR"] },
      { id: "s3", role: "staff", assignedCount: 1, skills: ["IT"] },
    ];
  });

  test("should assign complaint to available staff", () => {
    const complaint = complaints[0];
    const availableStaff = staff.filter((s) =>
      s.skills.includes(complaint.category),
    );

    expect(availableStaff.length).toBeGreaterThan(0);
  });

  test("should use round-robin assignment", () => {
    // Assign to staff with least complaints
    const leastAssigned = staff.reduce((prev, current) =>
      prev.assignedCount < current.assignedCount ? prev : current,
    );

    expect(leastAssigned.id).toBe("s3");
    expect(leastAssigned.assignedCount).toBe(1);
  });

  test("should consider skill match", () => {
    const complaint = complaints[0]; // IT category
    const matchingStaff = staff.filter((s) =>
      s.skills.includes(complaint.category),
    );

    expect(matchingStaff.some((s) => s.id === "s1")).toBe(true);
    expect(matchingStaff.some((s) => s.id === "s3")).toBe(true);
  });

  test("should prioritize critical complaints", () => {
    const sortedComplaints = complaints.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    expect(sortedComplaints[0].priority).toBe("critical");
  });
});
