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
  createSetupAdmin: vi.fn(),
}));

import { handleError } from '#/libs/error/index.server';
import { createSetupAdmin } from '#/core/setup/index.server';

import { action, middleware } from '#/routes/api/admin/v1/setup/admin';

const URL = 'http://shop.example/api/admin/v1/setup/admin';
const BODY = {
  name: 'Ada',
  email: 'ada@example.com',
  password: 'long-enough-password',
};

function post({ token, body = JSON.stringify(BODY) } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request(URL, { method: 'POST', headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SETUP_TOKEN;
  createSetupAdmin.mockResolvedValue({
    admin: { id: 'u1', email: 'ada@example.com', name: 'Ada', role: 'admin' },
  });
});

describe('POST /api/admin/v1/setup/admin', () => {
  it('uses the setup rate-limit policy', () => {
    expect(middleware.map((m) => m.policy)).toEqual(['setup']);
  });

  it('returns 405 for non-POST methods', async () => {
    const response = await action({ request: new Request(URL) });
    expect(response.status).toBe(405);
  });

  it('creates the admin without a token when SETUP_TOKEN is unset', async () => {
    const response = await action({ request: post() });
    expect(response.status).toBe(201);
    expect(createSetupAdmin).toHaveBeenCalledWith(BODY);
  });

  it('requires the token when SETUP_TOKEN is set', async () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';

    const missing = await action({ request: post() });
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({
      code: 'SETUP_TOKEN_REQUIRED',
    });

    const wrong = await action({ request: post({ token: 'wrong' }) });
    expect(wrong.status).toBe(401);
    expect(createSetupAdmin).not.toHaveBeenCalled();

    const ok = await action({ request: post({ token: 'shop-setup-secret' }) });
    expect(ok.status).toBe(201);
    expect(createSetupAdmin).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for invalid JSON', async () => {
    const response = await action({ request: post({ body: '{not json' }) });
    expect(response.status).toBe(400);
  });

  it('returns 409 when onboarding is no longer available', async () => {
    createSetupAdmin.mockRejectedValue(
      Object.assign(new Error('Onboarding is not available.'), {
        code: 'ONBOARDING_UNAVAILABLE',
      })
    );

    const response = await action({ request: post() });
    expect(response.status).toBe(409);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('returns 422 with field errors and replay fields on validation failure', async () => {
    createSetupAdmin.mockRejectedValue(
      Object.assign(new Error('Validation failed.'), {
        code: 'VALIDATION_ERROR',
        errors: { password: 'Too short.' },
      })
    );

    const response = await action({ request: post() });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      fieldErrors: { password: 'Too short.' },
      fields: { name: 'Ada', email: 'ada@example.com' },
    });
  });

  it('returns a generic 500 and alerts on unexpected errors', async () => {
    const err = new Error('database is locked');
    createSetupAdmin.mockRejectedValue(err);

    const response = await action({ request: post() });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(handleError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: 'api/admin/v1/setup/admin' })
    );
  });
});
