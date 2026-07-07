import '#/libs/auth/test-setup.server';
import { describe, expect, it } from 'vitest';

import { adminAuthHandlerMiddleware } from '#/libs/auth/admin.server';
import { customerAuthHandlerMiddleware } from '#/libs/auth/customer.server';

import { middleware as adminMiddleware } from '#/routes/auth/admin';
import { middleware as customerMiddleware } from '#/routes/auth/customer';

describe('auth route middleware', () => {
  it('admin route composes auth rate limiting and handler middleware', () => {
    expect(adminMiddleware).toHaveLength(2);
    expect(adminMiddleware[1]).toBe(adminAuthHandlerMiddleware);
  });

  it('customer route composes auth rate limiting and handler middleware', () => {
    expect(customerMiddleware).toHaveLength(2);
    expect(customerMiddleware[1]).toBe(customerAuthHandlerMiddleware);
  });
});
