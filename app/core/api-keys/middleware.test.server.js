// Tests for admin API key middleware behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/api-keys/index.server', () => ({
  validateApiKey: vi.fn(),
  apiKeyCanAccessAdminApi: vi.fn((scopes) =>
    (scopes ?? []).some((s) => s === 'admin' || s.includes(':'))
  ),
  apiKeySatisfiesScope: vi.fn((scopes, required) => {
    if ((scopes ?? []).includes(required)) return true;
    if (required === 'storefront') return false;
    return (scopes ?? []).includes('admin');
  }),
}));

import {
  apiKeyCanAccessAdminApi,
  validateApiKey,
} from '#/core/api-keys/index.server';
import {
  adminApiKeyContext,
  adminApiKeyMiddleware,
} from '#/core/api-keys/middleware.server';

/** Run middleware and return the thrown value (or null if it resolves). */
async function catchThrown(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

describe('adminApiKeyMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyCanAccessAdminApi.mockImplementation((scopes) =>
      (scopes ?? []).some((s) => s === 'admin' || String(s).includes(':'))
    );
  });

  it('throws a 401 JSON response when the API key is missing', async () => {
    validateApiKey.mockRejectedValue(
      Object.assign(new Error('API key required'), {
        code: 'KEY_REQUIRED',
        status: 401,
      })
    );

    const request = new Request('http://localhost:3000/api/admin/v1/products');
    const context = { set: vi.fn() };
    const next = vi.fn();

    const thrown = await catchThrown(() =>
      adminApiKeyMiddleware({ request, context }, next)
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(401);
    const body = await thrown.json();
    expect(body).toEqual({ error: 'API key required', code: 'KEY_REQUIRED' });
    expect(context.set).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('sets adminApiKeyContext when the API key is valid', async () => {
    const apiKey = { id: 'key-1', label: 'Test', scopes: ['admin'] };
    validateApiKey.mockResolvedValue(apiKey);

    const request = new Request('http://localhost:3000/api/admin/v1/products', {
      headers: { Authorization: 'Bearer berm_testkey' },
    });
    const context = { set: vi.fn() };
    const next = vi.fn(async () => new Response(null, { status: 200 }));

    await adminApiKeyMiddleware({ request, context }, next);

    expect(validateApiKey).toHaveBeenCalledWith('berm_testkey', []);
    expect(apiKeyCanAccessAdminApi).toHaveBeenCalledWith(['admin']);
    expect(context.set).toHaveBeenCalledWith(adminApiKeyContext, apiKey);
    expect(next).toHaveBeenCalledOnce();
  });

  it('throws 403 when the key cannot access the Admin API', async () => {
    const apiKey = { id: 'key-2', label: 'SF', scopes: ['storefront'] };
    validateApiKey.mockResolvedValue(apiKey);
    apiKeyCanAccessAdminApi.mockReturnValue(false);

    const request = new Request('http://localhost:3000/api/admin/v1/products', {
      headers: { Authorization: 'Bearer berm_sf' },
    });
    const context = { set: vi.fn() };
    const next = vi.fn();

    const thrown = await catchThrown(() =>
      adminApiKeyMiddleware({ request, context }, next)
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(403);
    expect(context.set).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
