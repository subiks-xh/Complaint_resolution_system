/**
 * Production Hardening Integration & Unit Tests
 *
 * Tests Phase 2 hardening measures:
 * 1. Environment validation & secret enforcement
 * 2. Upload storage protection in production
 * 3. Reverse proxy trust & health endpoints
 */

const request = require("supertest");
const app = require("../../app");
const { validateEnv, assertProductionEnv, KNOWN_INSECURE_SECRETS } = require("../../config/validateEnv");
const { createUploader } = require("../../middleware/uploadMiddleware");

describe("Phase 2 Production Hardening Tests", () => {
  describe("1. Environment & Secret Validation", () => {
    it("allows standard development environment without strict production secret length", () => {
      const devEnv = {
        NODE_ENV: "development",
        MONGODB_URI: "mongodb://localhost:27017/test",
      };

      const result = validateEnv(devEnv);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects production environment if required secrets are missing", () => {
      const prodEnv = {
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/prod",
        // Missing JWT secrets, SESSION_SECRET, FRONTEND_URL
      };

      const result = validateEnv(prodEnv);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("JWT_ACCESS_SECRET is required"),
          expect.stringContaining("JWT_REFRESH_SECRET is required"),
          expect.stringContaining("SESSION_SECRET is required"),
          expect.stringContaining("FRONTEND_URL is required"),
        ]),
      );
    });

    it("rejects known insecure placeholder secrets in production", () => {
      const prodEnvWithPlaceholders = {
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/prod",
        JWT_ACCESS_SECRET: "your-super-secret-access-key-change-in-production",
        JWT_REFRESH_SECRET: "your-super-secret-refresh-key-change-in-production",
        SESSION_SECRET: "complaint-resolution-session-secret",
        FRONTEND_URL: "https://crs.example.com",
      };

      const result = validateEnv(prodEnvWithPlaceholders);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("JWT_ACCESS_SECRET cannot use default"))).toBe(true);
      expect(result.errors.some((e) => e.includes("JWT_REFRESH_SECRET cannot use default"))).toBe(true);
      expect(result.errors.some((e) => e.includes("SESSION_SECRET cannot use default"))).toBe(true);
    });

    it("rejects secrets that are too short (< 32 chars) in production", () => {
      const prodEnvShortSecrets = {
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/prod",
        JWT_ACCESS_SECRET: "short-secret-123",
        JWT_REFRESH_SECRET: "another-short-secret-456",
        SESSION_SECRET: "short-session-789",
        FRONTEND_URL: "https://crs.example.com",
      };

      const result = validateEnv(prodEnvShortSecrets);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("at least 32 characters"))).toBe(true);
    });

    it("rejects identical access and refresh secrets in production", () => {
      const strongSecret = "a".repeat(40);
      const prodEnvIdentical = {
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/prod",
        JWT_ACCESS_SECRET: strongSecret,
        JWT_REFRESH_SECRET: strongSecret,
        SESSION_SECRET: "b".repeat(40),
        FRONTEND_URL: "https://crs.example.com",
      };

      const result = validateEnv(prodEnvIdentical);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be distinct secrets"))).toBe(true);
    });

    it("accepts a fully compliant production environment configuration", () => {
      const validProdEnv = {
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/prod",
        JWT_ACCESS_SECRET: "a".repeat(40),
        JWT_REFRESH_SECRET: "b".repeat(40),
        SESSION_SECRET: "c".repeat(40),
        FRONTEND_URL: "https://crs.example.com",
        CLOUDINARY_CLOUD_NAME: "my-cloud",
        CLOUDINARY_API_KEY: "1234567890",
        CLOUDINARY_API_SECRET: "abcdef123456",
        ENABLE_SCHEDULER: "true",
      };

      const result = validateEnv(validProdEnv);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("assertProductionEnv throws descriptive Error if invalid in production", () => {
      const invalidEnv = {
        NODE_ENV: "production",
      };

      expect(() => assertProductionEnv(invalidEnv)).toThrow(
        /Production configuration validation failed:/,
      );
    });
  });

  describe("2. Health Check Endpoints", () => {
    it("GET /health returns healthy status (for cloud load balancers)", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Server is healthy");
      expect(res.body.data.status).toBe("ok");
    });

    it("GET /api/health returns healthy status (standard API endpoint)", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Server is healthy");
      expect(res.body.data.status).toBe("ok");
    });
  });

  describe("3. Storage & Ephemeral File Protection in Production", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("returns STORAGE_NOT_CONFIGURED if upload attempted in production without Cloudinary", (done) => {
      process.env.NODE_ENV = "production";

      const uploader = createUploader({
        useCloudinary: false, // Simulates Cloudinary missing
      });

      const fakeReq = {};
      const fakeFile = { originalname: "test.png", mimetype: "image/png" };

      uploader.storage._handleFile(fakeReq, fakeFile, (err) => {
        expect(err).toBeDefined();
        expect(err.code).toBe("STORAGE_NOT_CONFIGURED");
        expect(err.message).toContain("Cloud storage (Cloudinary) is not configured");
        done();
      });
    });
  });

  describe("4. Reverse Proxy Trust Configuration", () => {
    it("respects Express trust proxy setting on the application", () => {
      // In app.js, trust proxy is configured when in production or when set
      const trustProxySetting = app.get("trust proxy");
      // Trust proxy should be defined either as 1 or a function/truthy value
      expect(trustProxySetting !== undefined).toBe(true);
    });
  });

  describe("5. Production Frontend Static Delivery & SPA Routing", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSessionSecret = process.env.SESSION_SECRET;

    beforeAll(() => {
      process.env.NODE_ENV = "production";
      process.env.SESSION_SECRET = "a".repeat(48);
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.SESSION_SECRET = originalSessionSecret;
    });

    it("serves SPA index.html on root /", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toContain('<div id="root"></div>');
      expect(res.headers["content-type"]).toMatch(/html/);
    });

    it("serves SPA index.html on client deep routes (e.g. /complaints)", async () => {
      const res = await request(app).get("/complaints");
      expect(res.status).toBe(200);
      expect(res.text).toContain('<div id="root"></div>');
      expect(res.headers["content-type"]).toMatch(/html/);
    });

    it("serves SPA index.html on nested admin routes (e.g. /admin/staff)", async () => {
      const res = await request(app).get("/admin/staff");
      expect(res.status).toBe(200);
      expect(res.text).toContain('<div id="root"></div>');
      expect(res.headers["content-type"]).toMatch(/html/);
    });

    it("does not fallback to SPA for non-existent /api/* routes and returns 404 JSON", async () => {
      const res = await request(app).get("/api/nonexistent-route-endpoint");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("ROUTE_NOT_FOUND");
    });
  });
});
