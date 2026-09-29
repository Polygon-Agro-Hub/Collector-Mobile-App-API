let NodeCache;
try {
  NodeCache = require("node-cache");
} catch (_) {}

let cache;
if (NodeCache) {
  /**
   * Shared in-memory cache instance (node-cache).
   * stdTTL: 0       => No automatic expiration. Data persists until explicitly updated.
   * checkperiod: 0  => No background timer cleanup. Only cleaned/updated when new data arrives.
   */
  cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
} else {
  /**
   * In-memory Map fallback with the exact same interface (stdTTL: 0).
   */
  const store = new Map();
  cache = {
    get: (key) => store.get(key),
    set: (key, val) => {
      store.set(key, val);
      return true;
    },
    flushAll: () => store.clear(),
  };
}

module.exports = cache;
