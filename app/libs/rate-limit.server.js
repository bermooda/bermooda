// app/libs/rate-limit.server.js
// Preset rate-limit policies and enforcement helpers.

import { consumeRateLimit } from '#/utils/rate-limit/index.server';

/** @type {Record<string, { limit: number, windowMs: number }>} */
export const RATE_LIMITS = {
  'auth': { limit: 20, windowMs: 60_000 },
  'api-public': { limit: 120, windowMs: 60_000 },
  'api-admin': { limit: 300, windowMs: 60_000 },
  'webhooks': { limit: 200, windowMs: 60_000 },
};

/**
 * Resolve a stable client key from the request.
 *
 * @param {Request} request
 */
export function getClientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Enforce a named rate limit policy. Throws a 429 Response when exceeded.
 *
 * @param {Request} request
 * @param {keyof typeof RATE_LIMITS} policy
 */
export function enforceRateLimit(request, policy) {
  const config = RATE_LIMITS[policy];
  if (!config) return;

  const key = `${policy}:${getClientKey(request)}:${new URL(request.url).pathname}`;
  const result = consumeRateLimit(key, config);

  if (!result.allowed) {
    throw Response.json(
      {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfterMs: result.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
}

/**
 * React Router middleware factory for rate limiting.
 *
 * @param {keyof typeof RATE_LIMITS} policy
 */
export function rateLimitMiddleware(policy) {
  return async function rateLimitMiddlewareHandler({ request }) {
    enforceRateLimit(request, policy);
  };
}
