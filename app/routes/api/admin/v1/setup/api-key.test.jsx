import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/rate-limit.server', () => ({
  rateLimitMiddleware: (policy) =>
    Object.assign(async (_args, next) => next(), { policy }),
}));

vi.mock('#/libs/error/index.server', () => ({
  handleError: vi.fn(),
}));

vi.mock('#/libs/prisma.server', () => ({ default: {} }));

vi.mock('#/core/setup/index.server', async (importOriginal) => ({
  ...(await importOriginal()),
  createBootstrapApiKey: vi.fn(),
}));

import { handleError } from '#/libs/error/index.server';
import { createBootstrapApiKey } from '#/core/setup/index.server';

import { action, middleware } from '#/routes/api/admin/v1/setup/api-key';

const URL = 'http://shop.example/api/admin/v1/setup/api-key';

function post({ token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Setup-Token'] = token;
  return new Request(URL, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SETUP_TOKEN;
});

describe('POST /api/admin/v1/setup/api-key', () => {
  it('uses the setup rate-limit policy', () => {
    expect(middleware.map((m) => m.policy)).toEqual(['setup']);
  });

  it('returns 405 for non-POST methods', async () => {
    const response = await action({ request: new Request(URL) });
    expect(response.status).toBe(405);
  });

  it('returns 401 when SETUP_TOKEN is not configured', async () => {
    const response = await action({ request: post({ token: 'anything' }) });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SETUP_TOKEN_REQUIRED',
    });
    expect(createBootstrapApiKey).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong token', async () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    const response = await action({ request: post({ token: 'wrong' }) });
    expect(response.status).toBe(401);
    expect(createBootstrapApiKey).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    const response = await action({
      request: post({ token: 'shop-setup-secret', body: '{not json' }),
    });
    expect(response.status).toBe(400);
  });

  it('creates the key with a valid token', async () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    createBootstrapApiKey.mockResolvedValue({
      key: 'berm_raw',
      apiKey: { id: 'k1', label: 'agent' },
    });

    const response = await action({
      request: post({
        token: 'shop-setup-secret',
        body: JSON.stringify({ label: 'agent' }),
      }),
    });

    expect(response.status).toBe(201);
    expect(createBootstrapApiKey).toHaveBeenCalledWith({ label: 'agent' });
    await expect(response.json()).resolves.toEqual({
      key: 'berm_raw',
      apiKey: { id: 'k1', label: 'agent' },
    });
  });

  it.each([
    ['BOOTSTRAP_KEY_EXISTS', 409, 409],
    ['ADMIN_REQUIRED', 422, 422],
    ['SCOPES_INVALID', undefined, 400],
  ])('maps domain error %s to %s', async (code, status, expected) => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    createBootstrapApiKey.mockRejectedValue(
      Object.assign(new Error(`${code} message`), { code, status })
    );

    const response = await action({
      request: post({ token: 'shop-setup-secret', body: '{}' }),
    });

    expect(response.status).toBe(expected);
    await expect(response.json()).resolves.toEqual({
      error: `${code} message`,
      code,
    });
    expect(handleError).not.toHaveBeenCalled();
  });

  it('returns a generic 500 and alerts on unexpected errors', async () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    const err = new Error('connect ECONNREFUSED 10.0.0.5:5432');
    createBootstrapApiKey.mockRejectedValue(err);

    const response = await action({
      request: post({ token: 'shop-setup-secret', body: '{}' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(handleError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: 'api/admin/v1/setup/api-key' })
    );
  });
});
