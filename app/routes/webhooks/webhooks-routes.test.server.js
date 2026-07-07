// app/routes/webhooks/webhooks-routes.test.server.js

import { describe, expect, it, vi } from 'vitest';

const { mockProcessPaymentProviderWebhook } = vi.hoisted(() => ({
  mockProcessPaymentProviderWebhook: vi.fn(),
}));

vi.mock('#/core/payments/inbound.server', () => ({
  processPaymentProviderWebhook: mockProcessPaymentProviderWebhook,
}));

import { action, middleware } from '#/routes/webhooks/$provider';

function makeRequest(method = 'POST') {
  return new Request('http://localhost/webhooks/stripe', { method });
}

describe('webhooks route middleware', () => {
  it('applies webhook rate limiting', () => {
    expect(middleware).toHaveLength(1);
    expect(middleware[0].name).toBe('rateLimitMiddlewareHandler');
  });
});

describe('webhooks route action', () => {
  it('returns 405 for non-POST requests', async () => {
    const res = await action({
      request: makeRequest('GET'),
      params: { provider: 'stripe' },
    });

    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toEqual({ error: 'Method not allowed' });
    expect(mockProcessPaymentProviderWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 with the core helper result', async () => {
    mockProcessPaymentProviderWebhook.mockResolvedValue({ received: true });

    const res = await action({
      request: makeRequest(),
      params: { provider: 'stripe' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(mockProcessPaymentProviderWebhook).toHaveBeenCalledWith(
      'stripe',
      expect.any(Request)
    );
  });

  it('returns 404 for unknown providers', async () => {
    mockProcessPaymentProviderWebhook.mockRejectedValue(
      Object.assign(new Error('Unknown provider'), {
        code: 'PROVIDER_NOT_FOUND',
        status: 404,
      })
    );

    const res = await action({
      request: makeRequest(),
      params: { provider: 'unknown' },
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Unknown provider' });
  });

  it('returns 400 when verification fails', async () => {
    mockProcessPaymentProviderWebhook.mockRejectedValue(
      Object.assign(new Error('Webhook verification failed'), {
        code: 'VERIFICATION_FAILED',
        status: 400,
      })
    );

    const res = await action({
      request: makeRequest(),
      params: { provider: 'stripe' },
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Webhook verification failed',
    });
  });
});
