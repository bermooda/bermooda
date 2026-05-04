import { TTLCache } from '@isaacs/ttlcache';

// Default TTL is 5 minutes
const DEFAULT_TTL = 1000 * 60 * 5;

const cache = new TTLCache({ max: 10000, ttl: DEFAULT_TTL });

/**
 * Gets a cached result from the cache.
 *
 * @param {string} key - The key to get the cached result for.
 * @param {() => Promise<any>} refreshCallback - The callback to refresh the cached result.
 * @returns {Promise<any>} - The cached result.
 */
export async function getCachedResult(key, refreshCallback, ttl = DEFAULT_TTL) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const result = await refreshCallback();
  cache.set(key, result, { ttl });

  return result;
}

export default cache;
