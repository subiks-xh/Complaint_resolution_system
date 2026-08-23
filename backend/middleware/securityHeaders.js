/**
 * Security Headers Middleware
 *
 * Configures Helmet for security best practices including:
 * - Content Security Policy (CSP)
 * - X-Frame-Options (Clickjacking protection)
 * - X-Content-Type-Options (MIME type sniffing prevention)
 * - Strict-Transport-Security
 * - X-XSS-Protection
 */

const helmet = require("helmet");

const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      ...(process.env.NODE_ENV === "production"
        ? { upgradeInsecureRequests: [] }
        : {}),
    },
    reportOnly: false,
  },

  // Prevent clickjacking
  frameguard: {
    action: "deny",
  },

  // Prevent MIME type sniffing
  noSniff: true,

  // Enable XSS filter
  xssFilter: true,

  // HSTS - redirect HTTP to HTTPS (18000 seconds = 5 hours)
  hsts:
    process.env.NODE_ENV === "production"
      ? {
          maxAge: 18000,
          includeSubDomains: true,
          preload: true,
        }
      : {
          maxAge: 3600,
          includeSubDomains: false,
        },

  // Hide powered by
  hidePoweredBy: true,

  // Referrer policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },

  // Permissions policy (formerly Feature-Policy)
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
    },
  },
});

module.exports = securityHeaders;
