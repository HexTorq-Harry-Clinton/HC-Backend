// Process-local API response cache for the Harry Clinton API.
// Reads are cached for five hours; every write invalidates the namespace so
// the next read is refreshed from SQL Server.
const CACHE_TTL_MS = 5 * 60 * 60 * 1000;
const cache = new Map();

const cacheKeyFor = (req) => {
  // Keep authenticated and public responses separate. Query parameters are
  // already part of originalUrl, including includeInactive/includeDeleted.
  const authScope = req.headers.authorization || 'public';
  return `${req.method}:${req.originalUrl}:${authScope}`;
};

const clearApiCache = () => cache.clear();

const apiCache = (req, res, next) => {
  if (req.method !== 'GET') {
    clearApiCache();
    res.once('finish', () => {
      // A successful or failed mutation must not leave stale records behind.
      clearApiCache();
    });
    return next();
  }

  const key = cacheKeyFor(req);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    res.set('X-HC-Cache', 'HIT');
    res.status(hit.status).type('application/json').send(hit.body);
    return;
  }
  if (hit) cache.delete(key);
  res.set('X-HC-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let stored = false;
  const store = (body, status = res.statusCode) => {
    if (stored || status < 200 || status >= 300) return;
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    if (!serialized) return;
    cache.set(key, { body: serialized, status, expiresAt: Date.now() + CACHE_TTL_MS });
    stored = true;
  };

  res.json = (body) => {
    store(body);
    return originalJson(body);
  };
  res.send = (body) => {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) store(body);
    return originalSend(body);
  };
  return next();
};

module.exports = { apiCache, clearApiCache, CACHE_TTL_MS };
