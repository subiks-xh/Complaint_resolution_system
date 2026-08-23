const morgan = require("morgan");
const logger = require("../utils/logger");

const createHttpLogger = () => {
  const format = process.env.NODE_ENV === "production" ? "combined" : "dev";

  return morgan(format, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  });
};

const requestContextLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return;
    }

    logger.info("User action", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id || null,
      role: req.user?.role || null,
      ip: req.ip,
    });
  });

  next();
};

module.exports = {
  createHttpLogger,
  requestContextLogger,
};
