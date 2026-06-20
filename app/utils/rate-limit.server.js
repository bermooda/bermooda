// app/utils/rate-limit.server.js
// In-memory sliding-window rate limiter for auth, API, and webhook endpoints.

const buckets = new Map();

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
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };

  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  if (bucket.count >= limit) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

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
