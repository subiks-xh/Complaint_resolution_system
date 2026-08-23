const cacheStore = new Map();

const getCacheKey = (req) => {
  const role = req.user?.role || "guest";
  const org = req.user?.organization || "none";
  return `${role}:${org}:${req.originalUrl}`;
};

const responseCache = (ttlSeconds = 60) => {
  return (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    const key = getCacheKey(req);
    const now = Date.now();
    const entry = cacheStore.get(key);

    if (entry && entry.expiresAt > now) {
      return res.status(entry.statusCode).json(entry.payload);
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      cacheStore.set(key, {
        payload,
        statusCode: res.statusCode || 200,
        expiresAt: now + ttlSeconds * 1000,
      });
      return originalJson(payload);
    };

    return next();
  };
};

const clearResponseCache = () => {
  cacheStore.clear();
};

module.exports = {
  responseCache,
  clearResponseCache,
};
