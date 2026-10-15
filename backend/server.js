/**
 * Server Entry Point
 *
 * This is the main entry point for the application.
 * It initializes the database connection, starts the server,
 * and sets up graceful shutdown handlers.
 */

// Load environment variables first
require("dotenv").config();

const http = require("http");
const app = require("./app");
const { connectDB, disconnectDB, getConnectionStatus } = require("./config/db");
const {
  startScheduler,
  stopScheduler,
} = require("./utils/escalationScheduler");
const {
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
  setupSIGTERMHandler,
} = require("./middleware/errorHandler");
const { initSentry } = require("./config/sentry");
const { assertProductionEnv } = require("./config/validateEnv");

/**
 * Server Configuration
 */
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Normalize port value
 */
const normalizePort = (val) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
};

/**
 * Server error handler
 */
const onError = (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof PORT === "string" ? "Pipe " + PORT : "Port " + PORT;

  switch (error.code) {
    case "EACCES":
      console.error(`❌ ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`❌ ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

/**
 * Server listening handler
 */
const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;

  console.log("");
  console.log("🚀 ═══════════════════════════════════════════════════════");
  console.log("");
  console.log(`   🌐 Server is running on ${bind}`);
  console.log(`   📍 Environment: ${NODE_ENV}`);
  console.log(`   🔗 URL: http://${HOST}:${PORT}`);
  console.log(`   📚 API: http://${HOST}:${PORT}/api`);
  console.log(`   ❤️  Health: http://${HOST}:${PORT}/api/health`);
  console.log("");
  console.log("═══════════════════════════════════════════════════════ 🚀");
  console.log("");
};

/**
 * Graceful shutdown function
 */
const gracefulShutdown = async (signal) => {
  console.log("");
  console.log(`📛 Received ${signal}. Starting graceful shutdown...`);
  console.log("");

  // Stop accepting new connections
  server.close(async () => {
    console.log("✅ HTTP server closed");

    try {
      // Stop scheduler
      stopScheduler();
      console.log("✅ Scheduler stopped");

      // Close database connection
      await disconnectDB();
      console.log("✅ Database connection closed");

      console.log("");
      console.log("👋 Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error(
      "❌ Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 30000);
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    console.log("");
    console.log("🔄 ═══════════════════════════════════════════════════════");
    console.log("");
    console.log("   🚀 Starting Complaint Resolution System...");
    console.log("");
    console.log("═══════════════════════════════════════════════════════ 🔄");
    console.log("");

    // Setup error handlers
    setupUncaughtExceptionHandler();

    // Validate production configuration before starting services
    if (process.env.NODE_ENV === "production") {
      console.log("🔒 Validating production environment configuration...");
      assertProductionEnv();
      console.log("✅ Production configuration validated successfully");
    }

    // Initialize Sentry if configured
    const sentryEnabled = initSentry();
    if (sentryEnabled) {
      console.log("🛡️  Sentry error tracking enabled");
    }

    // Connect to database
    console.log("📦 Connecting to database...");
    await connectDB();

    // Clean up legacy parallel-array index that can block assignment rule inserts
    const AssignmentRule = require("./models/AssignmentRule");
    await AssignmentRule.dropLegacyParallelArrayIndex();

    const dbStatus = getConnectionStatus();
    console.log(`✅ Database connected: ${dbStatus.name} @ ${dbStatus.host}`);

    // Start the escalation scheduler (disabled unless explicitly enabled)
    if (process.env.ENABLE_SCHEDULER === "true") {
      console.log("");
      console.log("⏰ Starting escalation scheduler...");
      startScheduler();
    } else {
      console.log("");
      console.log("⏸️  Scheduler is disabled (set ENABLE_SCHEDULER=true to enable)");
    }

    // Seed default categories if needed
    const Category = require("./models/Category");
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      console.log("");
      console.log("🌱 Seeding default categories...");
      await Category.seedDefaults();
    }

    // Normalize and set port
    const port = normalizePort(PORT);
    app.set("port", port);

    // Start listening
    server.listen(port, HOST);
    server.on("error", onError);
    server.on("listening", onListening);

    // Setup graceful shutdown handlers
    setupUnhandledRejectionHandler(server);
    setupSIGTERMHandler(server);

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle SIGTERM
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("");
    console.error("❌ ═══════════════════════════════════════════════════════");
    console.error("");
    console.error("   Failed to start server:", error.message);
    console.error("");
    console.error("═══════════════════════════════════════════════════════ ❌");
    console.error("");

    if (process.env.NODE_ENV === "development") {
      console.error(error.stack);
    }

    process.exit(1);
  }
};

// Start the server
startServer();

// Export server for testing
module.exports = server;
