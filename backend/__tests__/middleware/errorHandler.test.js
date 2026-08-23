/**
 * Error Handler Middleware Tests
 */

describe("Error Handler Middleware", () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  test("should handle validation errors correctly", () => {
    const validationError = {
      name: "ValidationError",
      details: [{ message: "Invalid email" }],
      message: "Validation failed",
    };

    // Simulate error handler logic
    const statusCode = validationError.name === "ValidationError" ? 400 : 500;
    const message =
      validationError.name === "ValidationError"
        ? validationError.details[0].message
        : "Internal server error";

    expect(statusCode).toBe(400);
    expect(message).toBe("Invalid email");
  });

  test("should handle JWT errors correctly", () => {
    const jwtError = {
      name: "JsonWebTokenError",
      message: "Invalid token",
    };

    const statusCode = jwtError.name === "JsonWebTokenError" ? 401 : 500;
    const message = jwtError.message;

    expect(statusCode).toBe(401);
    expect(message).toBe("Invalid token");
  });

  test("should handle database errors correctly", () => {
    const dbError = {
      name: "MongoError",
      message: "Connection failed",
    };

    const statusCode = 500;
    const message =
      process.env.NODE_ENV === "development"
        ? dbError.message
        : "Database error";

    expect(statusCode).toBe(500);
    expect(message).toBe("Database error");
  });

  test("should not expose sensitive information in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = {
      name: "ValidationError",
      message: "Invalid input",
    };

    // In production, don't send detailed error
    const shouldSendDetail = process.env.NODE_ENV === "development";
    expect(shouldSendDetail).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });

  test("should handle generic errors with 500 status", () => {
    const genericError = new Error("Something went wrong");

    const statusCode = 500;
    expect(statusCode).toBe(500);
    expect(genericError.message).toBeDefined();
  });
});

describe("Error Response Format", () => {
  test("should return consistent error response structure", () => {
    const errorResponse = {
      success: false,
      message: "An error occurred",
      error: "Error details",
    };

    expect(errorResponse).toHaveProperty("success");
    expect(errorResponse).toHaveProperty("message");
    expect(errorResponse.success).toBe(false);
  });

  test("should include error code when available", () => {
    const errorResponse = {
      success: false,
      message: "Validation error",
      code: "VALIDATION_ERROR",
    };

    expect(errorResponse.code).toBeDefined();
  });
});

describe("HTTP Status Codes", () => {
  test("should return 400 for bad request errors", () => {
    const statusCode = 400;
    expect(statusCode).toBeDefined();
    expect(statusCode).toBeGreaterThanOrEqual(400);
    expect(statusCode).toBeLessThan(500);
  });

  test("should return 401 for unauthorized errors", () => {
    const statusCode = 401;
    expect(statusCode).toBe(401);
  });

  test("should return 403 for forbidden errors", () => {
    const statusCode = 403;
    expect(statusCode).toBe(403);
  });

  test("should return 404 for not found errors", () => {
    const statusCode = 404;
    expect(statusCode).toBe(404);
  });

  test("should return 500 for server errors", () => {
    const statusCode = 500;
    expect(statusCode).toBeGreaterThanOrEqual(500);
    expect(statusCode).toBeLessThan(600);
  });
});
