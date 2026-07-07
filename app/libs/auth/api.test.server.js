// app/libs/auth/api.test.server.js
// Tests for admin API key middleware behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/api-keys/index.server', () => ({
  validateApiKey: vi.fn(),
}));

import {
  adminApiKeyContext,
  adminApiKeyMiddleware,
} from '#/libs/auth/api.server';
import { validateApiKey } from '#/core/api-keys/index.server';

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

    const thrown = await catchThrown(() =>
      adminApiKeyMiddleware({ request, context })
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(401);
    const body = await thrown.json();
    expect(body).toEqual({ error: 'API key required', code: 'KEY_REQUIRED' });
    expect(context.set).not.toHaveBeenCalled();
  });

  it('sets adminApiKeyContext when the API key is valid', async () => {
    const apiKey = { id: 'key-1', label: 'Test', scopes: ['admin'] };
    validateApiKey.mockResolvedValue(apiKey);

    const request = new Request('http://localhost:3000/api/admin/v1/products', {
      headers: { Authorization: 'Bearer berm_testkey' },
    });
    const context = { set: vi.fn() };

    await adminApiKeyMiddleware({ request, context });

    expect(validateApiKey).toHaveBeenCalledWith('berm_testkey', ['admin']);
    expect(context.set).toHaveBeenCalledWith(adminApiKeyContext, apiKey);
  });
});
