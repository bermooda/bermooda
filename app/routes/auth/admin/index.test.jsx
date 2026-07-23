import '#/libs/auth/test-setup.server';
import { describe, expect, it } from 'vitest';

import { adminAuthHandlerMiddleware } from '#/libs/auth/admin/index.server';

import { middleware as adminMiddleware } from '#/routes/auth/admin';

describe('auth admin route middleware', () => {
  it('admin route composes auth rate limiting and handler middleware', () => {
    expect(adminMiddleware).toHaveLength(2);
    expect(adminMiddleware[1]).toBe(adminAuthHandlerMiddleware);
  });
});
