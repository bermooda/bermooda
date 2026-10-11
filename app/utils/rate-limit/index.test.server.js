// app/utils/rate-limit/index.test.server.js

import { beforeEach, describe, expect, it } from 'vitest';

import {
  __rateLimitBucketCount,
  __resetRateLimits,
  consumeRateLimit,
} from '#/utils/rate-limit/index.server';

describe('rate-limit', () => {
  beforeEach(() => {
    __resetRateLimits();
  });

  it('allows requests under the limit', () => {
    const config = { limit: 3, windowMs: 60_000 };
    expect(consumeRateLimit('client-a', config).allowed).toBe(true);
    expect(consumeRateLimit('client-a', config).allowed).toBe(true);
    expect(consumeRateLimit('client-a', config).allowed).toBe(true);
  });

  it('blocks requests over the limit', () => {
    const config = { limit: 2, windowMs: 60_000 };
    consumeRateLimit('client-b', config);
    consumeRateLimit('client-b', config);
    const blocked = consumeRateLimit('client-b', config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('starts a new window once the old one expires', async () => {
    const config = { limit: 1, windowMs: 20 };
    consumeRateLimit('client-c', config);
    expect(consumeRateLimit('client-c', config).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(consumeRateLimit('client-c', config).allowed).toBe(true);
  });

  it('caps the number of buckets', () => {
    const config = { limit: 5, windowMs: 60_000 };
    for (let i = 0; i < 50_100; i += 1) {
      consumeRateLimit(`client-${i}`, config);
    }
    expect(__rateLimitBucketCount()).toBe(50_000);
  });
});
