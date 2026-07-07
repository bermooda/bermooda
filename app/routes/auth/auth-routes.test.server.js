import '#/libs/auth/test-setup.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminAuthTestState } from '#/libs/auth/test-setup.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';

import {
  loader as adminLoader,
  action as adminAction,
} from '#/routes/auth/admin';
import {
  loader as customerLoader,
  action as customerAction,
} from '#/routes/auth/customer';

describe('auth route handlers', () => {
  beforeEach(() => {
    vi.mocked(enforceRateLimit).mockReset();
    adminAuthTestState.sessionImpl.mockReset();
  });

  it('admin route rate-limits and delegates to adminAuth.handler', async () => {
    const request = new Request('http://localhost:3000/admin/auth/get-session');
    const response = Response.json({ session: null });
    const { adminAuth } = await import('#/libs/auth/admin.server');
    adminAuth.handler.mockResolvedValue(response);

    const loaderResult = await adminLoader({ request });
    const actionResult = await adminAction({ request });

    expect(enforceRateLimit).toHaveBeenCalledTimes(2);
    expect(enforceRateLimit).toHaveBeenCalledWith(request, 'auth');
    expect(adminAuth.handler).toHaveBeenCalledTimes(2);
    expect(adminAuth.handler).toHaveBeenCalledWith(request);
    expect(loaderResult).toBe(response);
    expect(actionResult).toBe(response);
  });

  it('customer route rate-limits and delegates to customerAuth.handler', async () => {
    const request = new Request(
      'http://localhost:3000/account/auth/get-session'
    );
    const response = Response.json({ session: null });
    const { customerAuth } = await import('#/libs/auth/customer.server');
    customerAuth.handler.mockResolvedValue(response);

    const loaderResult = await customerLoader({ request });
    const actionResult = await customerAction({ request });

    expect(enforceRateLimit).toHaveBeenCalledTimes(2);
    expect(enforceRateLimit).toHaveBeenCalledWith(request, 'auth');
    expect(customerAuth.handler).toHaveBeenCalledTimes(2);
    expect(customerAuth.handler).toHaveBeenCalledWith(request);
    expect(loaderResult).toBe(response);
    expect(actionResult).toBe(response);
  });
});
