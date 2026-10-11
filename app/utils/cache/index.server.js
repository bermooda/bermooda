import { TTLCache } from '@isaacs/ttlcache';

// Default TTL is 5 minutes
const DEFAULT_TTL = 1000 * 60 * 5;

const cache = new TTLCache({ max: 10000, ttl: DEFAULT_TTL });

/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map();

/**
 * Gets a cached result from the cache. Concurrent misses for the same key
 * share one refresh, and a refresh that was invalidated while running is
 * returned to its callers but not cached.
 *
 * @template T
 * @param {string} key - The key to get the cached result for.
 * @param {() => Promise<T>} refreshCallback - The callback to refresh the cached result.
 * @param {number} [ttl] - Optional TTL in milliseconds.
 * @returns {Promise<T>} - The cached result.
 */
export async function getCachedResult(key, refreshCallback, ttl = DEFAULT_TTL) {
  if (cache.has(key)) {
    return /** @type {T} */ (cache.get(key));
  }

  const pending = inflight.get(key);
  if (pending) {
    return /** @type {Promise<T>} */ (pending);
  }

  const refresh = Promise.resolve()
    .then(refreshCallback)
    .then(
      (result) => {
        if (inflight.get(key) === refresh) {
          inflight.delete(key);
          cache.set(key, result, { ttl });
        }
        return result;
      },
      (error) => {
        if (inflight.get(key) === refresh) inflight.delete(key);
        throw error;
      }
    );
  inflight.set(key, refresh);

  return refresh;
}

/**
 * Invalidate a single cache key.
 *
 * @param {string} key
 * @returns {void}
 */
export function invalidateCacheKey(key) {
  cache.delete(key);
  inflight.delete(key);
}

/**
 * Invalidate all keys with the given prefix.
 *
 * @param {string} prefix
 * @returns {void}
 */
export function invalidateCachePrefix(prefix) {
  for (const key of /** @type {Iterable<string>} */ (cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) {
      inflight.delete(key);
    }
  }
}

/**
 * Drop every cached and in-flight entry.
 *
 * @returns {void}
 */
export function clearCache() {
  cache.clear();
  inflight.clear();
}
