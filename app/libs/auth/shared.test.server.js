import '#/libs/auth/test-setup.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLoginRedirectUrl,
  createAuthRouteHandlers,
  getLocalNetworkUrl,
  getTrustedOrigins,
  pickAuthUserContextFields,
} from '#/libs/auth/shared.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';

describe('getLocalNetworkUrl', () => {
  it('returns null when no external IPv4 interfaces are available', () => {
    expect(getLocalNetworkUrl()).toBeNull();
  });
});

describe('getTrustedOrigins', () => {
  it('includes the configured base URL', () => {
    expect(getTrustedOrigins()).toContain('http://localhost:3000');
  });
});

describe('buildLoginRedirectUrl', () => {
  it('preserves the current path and query string as returnTo', () => {
    const request = new Request(
      'http://localhost:3000/account/orders?status=pending'
    );

    const url = buildLoginRedirectUrl('/account/login', request);

    expect(url).toContain('returnTo=');
    expect(decodeURIComponent(url)).toContain('/account/orders?status=pending');
  });

  it('accepts a raw URL string', () => {
    const url = buildLoginRedirectUrl(
      '/admin/login',
      'http://localhost:3000/admin/products?page=2'
    );

    expect(decodeURIComponent(url)).toContain('/admin/products?page=2');
  });
});

describe('pickAuthUserContextFields', () => {
  it('returns the fields stored in auth middleware context', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(
      pickAuthUserContextFields({
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true,
        createdAt,
        updatedAt,
        role: 'admin',
      })
    ).toEqual({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true,
      createdAt,
      updatedAt,
    });
  });
});

describe('createAuthRouteHandlers', () => {
  beforeEach(() => {
    vi.mocked(enforceRateLimit).mockReset();
  });

  it('applies auth rate limiting and delegates to the auth handler', async () => {
    const request = new Request('http://localhost:3000/admin/auth/get-session');
    const response = Response.json({ session: null });
    const auth = { handler: vi.fn().mockResolvedValue(response) };
    const { loader, action } = createAuthRouteHandlers(auth);

    const loaderResult = await loader({ request });
    const actionResult = await action({ request });

    expect(enforceRateLimit).toHaveBeenCalledTimes(2);
    expect(enforceRateLimit).toHaveBeenCalledWith(request, 'auth');
    expect(auth.handler).toHaveBeenCalledTimes(2);
    expect(auth.handler).toHaveBeenCalledWith(request);
    expect(loaderResult).toBe(response);
    expect(actionResult).toBe(response);
  });

  it('rethrows rate-limit responses without calling the auth handler', async () => {
    const request = new Request('http://localhost:3000/account/auth/sign-in');
    const rateLimitResponse = new Response(null, { status: 429 });
    vi.mocked(enforceRateLimit).mockImplementation(() => {
      throw rateLimitResponse;
    });
    const auth = { handler: vi.fn() };
    const { loader } = createAuthRouteHandlers(auth);

    await expect(loader({ request })).rejects.toBe(rateLimitResponse);
    expect(auth.handler).not.toHaveBeenCalled();
  });
});
