const session = require("express-session");
const csurf = require("csurf");

const getSessionSecret = () => {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SESSION_SECRET;
    if (
      !secret ||
      secret === "complaint-resolution-session-secret" ||
      secret.length < 32
    ) {
      throw new Error(
        "SESSION_SECRET must be configured with a secure secret (>=32 chars) in production.",
      );
    }
    return secret;
  }
  return process.env.SESSION_SECRET || "complaint-resolution-session-secret";
};

const sessionMiddleware = (req, res, next) => {
  return session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })(req, res, next);
};

const csrfProtection = csurf();

const excludedPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/register-staff",
  "/api/auth/register-org",
  "/api/auth/register-admin",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification-email",
  "/api/auth/refresh-token",
  "/api/auth/google",
  "/api/auth/google/onboarding",
  "/api/health",
  "/api/health/detailed",
  "/api-docs",
  "/api-docs.json",
]);

const conditionalCsrfProtection = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  if (excludedPaths.has(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return next();
  }

  return csrfProtection(req, res, next);
};

const getCsrfToken = (req, res) => {
  const token = req.csrfToken();

  res.status(200).json({
    success: true,
    data: { csrfToken: token },
  });
};

const csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== "EBADCSRFTOKEN") {
    return next(err);
  }

  return res.status(403).json({
    success: false,
    message: "Invalid CSRF token",
    code: "INVALID_CSRF_TOKEN",
  });
};

module.exports = {
  sessionMiddleware,
  csrfProtection,
  conditionalCsrfProtection,
  getCsrfToken,
  csrfErrorHandler,
};
