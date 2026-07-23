import { describe, expect, it } from 'vitest';

import { middleware as apiV1Middleware } from '#/routes/api/v1/_layout';

describe('api/v1 route middleware', () => {
  it('composes public API rate limiting middleware', () => {
    expect(apiV1Middleware).toHaveLength(1);
    expect(apiV1Middleware[0].name).toBe('rateLimitMiddlewareHandler');
  });
});
