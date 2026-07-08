import { TTLCache } from '@isaacs/ttlcache';

// Default TTL is 5 minutes
const DEFAULT_TTL = 1000 * 60 * 5;

const cache = new TTLCache({ max: 10000, ttl: DEFAULT_TTL });

/**
 * Gets a cached result from the cache.
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

  const result = await refreshCallback();
  cache.set(key, result, { ttl });

  return result;
}

/**
 * Invalidate a single cache key.
 *
 * @param {string} key
 */
export function invalidateCacheKey(key) {
  cache.delete(key);
}

/**
 * Invalidate all keys with the given prefix.
 *
 * @param {string} prefix
 */
export function invalidateCachePrefix(prefix) {
  for (const key of /** @type {Iterable<string>} */ (cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export default cache;
