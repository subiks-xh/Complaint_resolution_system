/**
 * Swagger Configuration and Documentation
 *
 * Provides API documentation at: http://localhost:3000/api-docs
 */

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Complaint Resolution & Escalation System API",
      version: "1.0.0",
      description:
        "Enterprise-grade API for managing organizational complaints with automated escalation and SLA tracking.",
      contact: {
        name: "API Support",
        email: "support@complaint-system.com",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3000",
        description: "Development Server",
      },
      {
        url: process.env.PROD_API_URL || "https://api.complaint-system.com",
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from login endpoint",
        },
        CookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "authToken",
          description: "Authentication cookie (HTTP-only)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "An error occurred",
            },
            code: {
              type: "string",
              example: "INTERNAL_SERVER_ERROR",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "MongoDB ObjectId",
            },
            email: {
              type: "string",
              format: "email",
            },
            name: {
              type: "string",
            },
            role: {
              type: "string",
              enum: ["user", "staff", "admin"],
            },
            department: {
              type: "string",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Complaint: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            complaintId: {
              type: "string",
              description: "Human-readable complaint ID (e.g., TKT-1001)",
            },
            title: {
              type: "string",
            },
            description: {
              type: "string",
            },
            category: {
              type: "string",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            status: {
              type: "string",
              enum: [
                "new",
                "assigned",
                "in-progress",
                "resolved",
                "closed",
                "escalated",
                "reopened",
              ],
            },
            user: {
              type: "string",
              description: "User ID who submitted the complaint",
            },
            assignedTo: {
              type: "string",
              description: "Staff member ID assigned to resolve",
            },
            resolutionDeadline: {
              type: "string",
              format: "date-time",
            },
            slaBreached: {
              type: "boolean",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        StaffFeedback: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            staffMember: {
              type: "string",
              description: "Staff member ID being rated",
            },
            rating: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            category: {
              type: "string",
              enum: [
                "general",
                "communication",
                "technical",
                "timeliness",
                "problem_solving",
                "attitude",
                "customer_service",
              ],
            },
            comment: {
              type: "string",
            },
            feedbackType: {
              type: "string",
              enum: ["admin", "user"],
            },
            isAnonymous: {
              type: "boolean",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User login, registration, and session management",
      },
      {
        name: "Complaints",
        description: "User complaint operations",
      },
      {
        name: "Staff",
        description: "Staff member operations",
      },
      {
        name: "Admin",
        description: "Administrator operations",
      },
      {
        name: "Feedback",
        description: "Staff feedback and ratings",
      },
    ],
  },
  apis: [
    "./routes/authRoutes.js",
    "./routes/complaintRoutes.js",
    "./routes/staffRoutes.js",
    "./routes/adminRoutes.js",
    "./routes/userRoutes.js",
    "./routes/feedbackRoutes.js",
    "./routes/categoryRoutes.js",
  ],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI
 * @param {Express} app - Express application
 */
const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUi.serve);

  app.get(
    "/api-docs",
    swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );

  // Serve raw swagger spec as JSON
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log(
    "✓ Swagger documentation available at http://localhost:3000/api-docs",
  );
};

module.exports = { setupSwagger, swaggerSpec };
