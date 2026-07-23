import '#/libs/auth/test-setup.server';
import { describe, expect, it } from 'vitest';

import { customerAuthHandlerMiddleware } from '#/libs/auth/customer/index.server';

import { middleware as customerMiddleware } from '#/routes/auth/customer/index';

describe('auth customer route middleware', () => {
  it('customer route composes auth rate limiting and handler middleware', () => {
    expect(customerMiddleware).toHaveLength(2);
    expect(customerMiddleware[1]).toBe(customerAuthHandlerMiddleware);
  });
});
