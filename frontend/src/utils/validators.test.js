import { describe, expect, it } from "vitest";
import { complaintSchema, registerSchema } from "./validators";

describe("validators", () => {
  it("accepts valid complaint payload", () => {
    const result = complaintSchema.safeParse({
      title: "Internet not working",
      category: "IT",
      priority: "high",
      description: "Internet has been down on floor 3 since this morning.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects complaint with short description", () => {
    const result = complaintSchema.safeParse({
      title: "Issue",
      category: "IT",
      priority: "low",
      description: "Too short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects registration when passwords do not match", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      department: "IT",
      password: "Password123",
      confirmPassword: "Password321",
    });

    expect(result.success).toBe(false);
  });
});
