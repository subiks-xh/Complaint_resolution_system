const Sentry = require("@sentry/node");

let enabled = false;

const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.npm_package_version || "1.0.0",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });

  enabled = true;
  return true;
};

const captureException = (error, context = {}) => {
  if (!enabled) {
    return;
  }

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
};

module.exports = {
  initSentry,
  captureException,
};
