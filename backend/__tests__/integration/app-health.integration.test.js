const request = require("supertest");
const app = require("../../app");

describe("App health integration", () => {
  it("GET / returns API metadata", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        documentation: "/api-docs",
        health: "/api/health",
      },
    });
  });

  it("GET /api/health returns healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.environment).toBe("test");
  });

  it("GET /api/health/detailed returns diagnostic payload", async () => {
    const response = await request(app).get("/api/health/detailed");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("database");
    expect(response.body.data).toHaveProperty("scheduler");
  });
});
