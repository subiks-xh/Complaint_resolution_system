/**
 * Environment Configuration Validator
 *
 * Validates required environment variables for production security and reliability.
 * Prevents production startup with missing or insecure default secrets.
 */

const KNOWN_INSECURE_SECRETS = new Set([
  "your-super-secret-access-key-change-in-production",
  "your-super-secret-refresh-key-change-in-production",
  "complaint-resolution-session-secret",
  "secret",
  "changeme",
  "password",
  "123456",
  "jwt-secret",
  "session-secret",
]);

/**
 * Validate environment variables for production readiness
 *
 * @param {Object} env - Environment object (defaults to process.env)
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
const validateEnv = (env = process.env) => {
  const isProduction = env.NODE_ENV === "production";
  const errors = [];
  const warnings = [];

  // 1. Database URI validation
  if (!env.MONGODB_URI) {
    errors.push("MONGODB_URI is required for database connectivity.");
  }

  // Production-only strict validations
  if (isProduction) {
    // 2. JWT Access Secret
    if (!env.JWT_ACCESS_SECRET) {
      errors.push("JWT_ACCESS_SECRET is required in production.");
    } else if (KNOWN_INSECURE_SECRETS.has(env.JWT_ACCESS_SECRET.toLowerCase())) {
      errors.push(
        "JWT_ACCESS_SECRET cannot use default or known insecure development placeholder values.",
      );
    } else if (env.JWT_ACCESS_SECRET.length < 32) {
      errors.push(
        "JWT_ACCESS_SECRET must be at least 32 characters long for cryptographic security in production.",
      );
    }

    // 3. JWT Refresh Secret
    if (!env.JWT_REFRESH_SECRET) {
      errors.push("JWT_REFRESH_SECRET is required in production.");
    } else if (KNOWN_INSECURE_SECRETS.has(env.JWT_REFRESH_SECRET.toLowerCase())) {
      errors.push(
        "JWT_REFRESH_SECRET cannot use default or known insecure development placeholder values.",
      );
    } else if (env.JWT_REFRESH_SECRET.length < 32) {
      errors.push(
        "JWT_REFRESH_SECRET must be at least 32 characters long for cryptographic security in production.",
      );
    } else if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      errors.push(
        "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct secrets.",
      );
    }

    // 4. Session Secret
    if (!env.SESSION_SECRET) {
      errors.push("SESSION_SECRET is required in production.");
    } else if (KNOWN_INSECURE_SECRETS.has(env.SESSION_SECRET.toLowerCase())) {
      errors.push(
        "SESSION_SECRET cannot use default or known insecure development placeholder values.",
      );
    } else if (env.SESSION_SECRET.length < 32) {
      errors.push(
        "SESSION_SECRET must be at least 32 characters long in production.",
      );
    }

    // 5. Canonical Frontend URL
    if (!env.FRONTEND_URL) {
      errors.push(
        "FRONTEND_URL is required in production for CORS and cookie origin security.",
      );
    } else if (
      !env.FRONTEND_URL.startsWith("https://") &&
      !env.FRONTEND_URL.startsWith("http://")
    ) {
      errors.push(
        "FRONTEND_URL must include a valid protocol (https:// or http://).",
      );
    }

    // 6. Cloudinary Storage (Required for non-ephemeral attachment persistence)
    const hasCloudinary =
      Boolean(env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(env.CLOUDINARY_API_KEY) &&
      Boolean(env.CLOUDINARY_API_SECRET) &&
      env.CLOUDINARY_CLOUD_NAME !== "your-cloud-name" &&
      env.CLOUDINARY_API_KEY !== "your-api-key" &&
      env.CLOUDINARY_API_SECRET !== "your-api-secret";

    if (!hasCloudinary) {
      warnings.push(
        "Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or set to placeholders. File uploads in production will be rejected to prevent data loss on ephemeral container filesystems.",
      );
    }

    // 7. Scheduler status check
    if (env.ENABLE_SCHEDULER !== "true") {
      warnings.push(
        "Escalation scheduler is disabled (ENABLE_SCHEDULER is not 'true'). Hourly SLA escalation will not run on this instance.",
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Assert that production environment is valid.
 * Throws an Error with all violation details if invalid.
 *
 * @param {Object} env - Environment object (defaults to process.env)
 */
const assertProductionEnv = (env = process.env) => {
  const { isValid, errors, warnings } = validateEnv(env);

  if (warnings.length > 0) {
    warnings.forEach((warn) => console.warn(`⚠️  [Config Warning] ${warn}`));
  }

  if (!isValid) {
    const errorMessage = [
      "Production configuration validation failed:",
      ...errors.map((err) => `  - ${err}`),
    ].join("\n");
    throw new Error(errorMessage);
  }
};

module.exports = {
  validateEnv,
  assertProductionEnv,
  KNOWN_INSECURE_SECRETS,
};
