// app/utils/rate-limit/index.server.js
// In-memory fixed-window rate limiter for auth, API, and webhook endpoints.

import { TTLCache } from '@isaacs/ttlcache';

// Buckets expire with their window. The cap bounds memory when many clients
// or paths are seen; past it, the buckets closest to expiry are dropped first.
const MAX_BUCKETS = 50_000;

/** @type {TTLCache<string, { count: number }>} */
const buckets = new TTLCache({ max: MAX_BUCKETS, checkAgeOnGet: true });

/**
 * @typedef {{ limit: number, windowMs: number }} RateLimitConfig
 */

/**
 * Consume one token from the rate limit bucket.
 *
 * @param {string} key
 * @param {RateLimitConfig} config
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function consumeRateLimit(key, { limit, windowMs }) {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { count: 0 };
    buckets.set(key, bucket, { ttl: windowMs });
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, Math.ceil(buckets.getRemainingTTL(key))),
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterMs: 0,
  };
}

/** Reset all buckets — test use only. */
export function __resetRateLimits() {
  buckets.clear();
}

/**
 * Number of live buckets — test use only.
 *
 * @returns {number}
 */
export function __rateLimitBucketCount() {
  return buckets.size;
}
