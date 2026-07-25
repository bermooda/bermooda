import { describe, expect, it } from 'vitest';

import { middleware as adminApiMiddleware } from '#/routes/api/admin/v1/_layout';

describe('api/admin/v1 route middleware', () => {
  it('composes rate limit, API key auth, and mutation audit middleware', () => {
    expect(adminApiMiddleware).toHaveLength(3);
    expect(adminApiMiddleware[0].name).toBe('rateLimitMiddlewareHandler');
    expect(adminApiMiddleware[1].name).toBe('adminApiKeyMiddleware');
    expect(adminApiMiddleware[2].name).toBe('adminApiAuditMiddleware');
  });
});
