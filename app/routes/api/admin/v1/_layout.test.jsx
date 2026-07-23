import { describe, expect, it } from 'vitest';

import { middleware as adminApiMiddleware } from '#/routes/api/admin/v1/_layout';

describe('api/admin/v1 route middleware', () => {
  it('composes admin API rate limiting and API key auth middleware', () => {
    expect(adminApiMiddleware).toHaveLength(2);
    expect(adminApiMiddleware[0].name).toBe('rateLimitMiddlewareHandler');
    expect(adminApiMiddleware[1].name).toBe('adminApiKeyMiddleware');
  });
});
