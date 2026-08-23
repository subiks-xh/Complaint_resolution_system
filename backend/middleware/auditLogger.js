const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const shouldAudit = (req) => {
  if (!MUTATING_METHODS.has(req.method)) return false;
  if (!req.originalUrl?.startsWith("/api/")) return false;
  if (req.originalUrl.startsWith("/api/health")) return false;
  if (req.originalUrl.startsWith("/api-docs")) return false;
  return true;
};

const buildActionName = (req) => {
  const cleanPath = req.originalUrl.split("?")[0];
  return `${req.method} ${cleanPath}`;
};

const auditLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", async () => {
    if (!shouldAudit(req)) {
      return;
    }

    try {
      const actorId = req.user?.id || null;
      const organization = req.user?.organization || null;

      await AuditLog.create({
        actorId,
        actorName: req.user?.name || null,
        actorRole: req.user?.role || null,
        action: buildActionName(req),
        method: req.method,
        path: req.originalUrl.split("?")[0],
        statusCode: res.statusCode,
        organization,
        metadata: {
          query: req.query,
        },
        ip: req.ip,
        userAgent: req.get("User-Agent") || null,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      logger.warn("Failed to persist audit log", {
        message: error.message,
        method: req.method,
        path: req.originalUrl,
      });
    }
  });

  next();
};

module.exports = auditLogger;
