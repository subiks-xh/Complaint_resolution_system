/**
 * Express Application Configuration
 *
 * This file sets up the Express application with all middleware,
 * routes, security configurations, and error handling.
 */

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const logger = require("./utils/logger");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const staffRoutes = require("./routes/staffRoutes");
const adminRoutes = require("./routes/adminRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const templateRoutes = require("./routes/templateRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");

// Import middleware
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

/**
 * Create Express application
 */
const app = express();

// Configure trust proxy safely for reverse proxies (Render, Railway, Fly.io, ALB, etc.)
// Trusting 1 hop correctly identifies client IP without blindly trusting client-supplied headers
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY) {
  const trustProxyEnv = process.env.TRUST_PROXY;
  const trustProxyValue = trustProxyEnv
    ? (!isNaN(Number(trustProxyEnv))
        ? Number(trustProxyEnv)
        : trustProxyEnv === "true"
          ? 1
          : trustProxyEnv)
    : 1;
  app.set("trust proxy", trustProxyValue);
}

// Import security middleware
const { sanitizeMiddleware } = require("./middleware/sanitizer");
const {
  apiLimiter,
  loginLimiter,
  uploadLimiter,
  complaintSubmitLimiter,
} = require("./middleware/rateLimiter");
const securityHeaders = require("./middleware/securityHeaders");
const { setupSwagger } = require("./config/swagger");
const {
  createHttpLogger,
  requestContextLogger,
} = require("./middleware/requestLogger");
const auditLogger = require("./middleware/auditLogger");
const {
  sessionMiddleware,
  csrfProtection,
  conditionalCsrfProtection,
  getCsrfToken,
  csrfErrorHandler,
} = require("./middleware/csrf");

/**
 * ================================
 * Security Middleware
 * ================================
 */

// Set security HTTP headers
app.use(securityHeaders);

// Enable CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];

    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-API-Key",
  ],
  exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit"],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// Apply general API rate limiting
app.use("/api", apiLimiter);

// Stricter rate limiting for login and password reset
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", loginLimiter);

// Route-specific rate limiting
app.use("/api/complaints", complaintSubmitLimiter);
app.use("/api/uploads", uploadLimiter);

/**
 * ================================
 * Body Parsing Middleware
 * ================================
 */

// Parse JSON bodies
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Parse URL-encoded bodies
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

// Parse cookies
app.use(cookieParser());

// Compress response payloads for better network performance
app.use(compression());

// Disable ETags for API routes (GET requests should always return fresh data)
// This prevents 304 Not Modified responses that have no body
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  res.removeHeader("ETag");
  next();
});

// Session + CSRF setup (for cookie-based auth flows)
app.use(sessionMiddleware);
app.use(conditionalCsrfProtection);

// CSRF token endpoint for clients using cookie-based sessions
app.get("/api/csrf-token", csrfProtection, getCsrfToken);

// Sanitize request payloads to prevent XSS
app.use(sanitizeMiddleware);

// Sanitize data to prevent NoSQL injection
app.use(
  mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
      logger.warn("NoSQL injection attempt detected", {
        key,
        path: req.path,
        ip: req.ip,
      });
    },
  }),
);

/**
 * ================================
 * Logging Middleware
 * ================================
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Morgan logging
app.use(createHttpLogger());
app.use(requestContextLogger);
app.use(auditLogger);

// Custom request logging middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  // Log request in development
  if (
    process.env.NODE_ENV === "development" &&
    process.env.LOG_LEVEL === "debug"
  ) {
    logger.debug(`📨 ${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== "GET" ? "[BODY]" : undefined,
      ip: req.ip,
    });
  }

  next();
});

/**
 * ================================
 * Static Files
 * ================================
 */

// Serve uploaded files (development only)
if (process.env.NODE_ENV === "development") {
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use("/uploads", express.static(uploadsDir));
}

/**
 * ================================
 * Health Check Routes
 * ================================
 */

// Basic health check (standard /api/health and root /health for cloud load balancers)
const handleBasicHealthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    },
  });
};

app.get("/health", handleBasicHealthCheck);
app.get("/api/health", handleBasicHealthCheck);

// Detailed health check
app.get("/api/health/detailed", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { getConnectionStatus } = require("./config/db");
    const { getSchedulerStatus } = require("./utils/escalationScheduler");

    const dbStatus = getConnectionStatus();
    const schedulerStatus = getSchedulerStatus();

    res.status(200).json({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
        node: process.version,
        memory: {
          used:
            Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
          total:
            Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
        },
        database: {
          status: dbStatus.state,
          connected: dbStatus.isConnected,
          host: dbStatus.host,
          name: dbStatus.name,
        },
        scheduler: schedulerStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        status: "error",
        error: error.message,
      },
    });
  }
});

/**
 * ================================
 * API Routes
 * ================================
 */

// API version prefix
const API_PREFIX = "/api";
const frontendDistPath = path.resolve(__dirname, "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const servesFrontend =
  process.env.NODE_ENV === "production" && fs.existsSync(frontendIndexPath);

// Swagger API documentation
setupSwagger(app);

// Mount routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/complaints`, complaintRoutes);
app.use(`${API_PREFIX}/staff`, staffRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/admin/assignments`, assignmentRoutes);
app.use(`${API_PREFIX}/admin`, assignmentRoutes);
app.use(`${API_PREFIX}/feedback`, feedbackRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/admin/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/templates`, templateRoutes);
app.use(`${API_PREFIX}/chatbot`, chatbotRoutes);

/**
 * ================================
 * Production Frontend Assets
 * ================================
 */

const getServesFrontend = () =>
  process.env.NODE_ENV === "production" && fs.existsSync(frontendIndexPath);

// Serve static assets from frontend/dist in production
app.use((req, res, next) => {
  if (getServesFrontend() && !req.path.startsWith("/api")) {
    return express.static(frontendDistPath)(req, res, next);
  }
  next();
});

// SPA client route fallback in production
app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
  if (getServesFrontend()) {
    return res.sendFile(frontendIndexPath);
  }
  next();
});

/**
 * ================================
 * Root Route
 * ================================
 */

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Complaint Resolution System API",
    data: {
      version: "1.0.0",
      documentation: "/api-docs",
      health: "/api/health",
      endpoints: {
        auth: `${API_PREFIX}/auth`,
        users: `${API_PREFIX}/users`,
        complaints: `${API_PREFIX}/complaints`,
        staff: `${API_PREFIX}/staff`,
        admin: `${API_PREFIX}/admin`,
        assignments: `${API_PREFIX}/admin/assignments`,
        feedback: `${API_PREFIX}/feedback`,
        categories: `${API_PREFIX}/categories`,
      },
    },
  });
});

app.get("/", (req, res, next) => {
  if (getServesFrontend()) {
    return res.sendFile(frontendIndexPath);
  }
  res.status(200).json({
    success: true,
    message: "Welcome to Complaint Resolution System API",
    data: {
      version: "1.0.0",
      documentation: "/api-docs",
      health: "/api/health",
      endpoints: {
        auth: `${API_PREFIX}/auth`,
        users: `${API_PREFIX}/users`,
        complaints: `${API_PREFIX}/complaints`,
        staff: `${API_PREFIX}/staff`,
        admin: `${API_PREFIX}/admin`,
        assignments: `${API_PREFIX}/admin/assignments`,
        feedback: `${API_PREFIX}/feedback`,
        categories: `${API_PREFIX}/categories`,
      },
    },
  });
});

/**
 * ================================
 * Error Handling
 * ================================
 */

// Handle 404 - Route not found
app.use(notFoundHandler);

// CSRF error handler
app.use(csrfErrorHandler);

// Global error handler
app.use(errorHandler);

/**
 * ================================
 * Export Application
 * ================================
 */

module.exports = app;
