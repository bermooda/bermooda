// app/utils/rate-limit.test.server.js

import { beforeEach, describe, expect, it } from 'vitest';

import { __resetRateLimits, consumeRateLimit } from '#/utils/rate-limit.server';

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
  });
});
