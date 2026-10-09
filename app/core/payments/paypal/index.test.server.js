// app/core/payments/paypal.test.server.js

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

import { paypalProvider } from '#/core/payments/paypal/index.server';

describe('paypalProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it('returns dev fallback session when credentials are missing', async () => {
    const result = await paypalProvider.createCheckoutSession({
      cart: {
        currency: 'USD',
        lines: [{ priceCentsSnapshot: 1999, quantity: 1 }],
      },
      orderId: 'ord_1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(result.id).toContain('paypal_dev');
    expect(result.url).toBe('https://example.com/success');
  });

  it('handles CHECKOUT.ORDER.APPROVED webhook', async () => {
    const result = await paypalProvider.handleWebhookEvent({
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: {
        custom_id: 'ord_abc',
        purchase_units: [{ custom_id: 'ord_abc' }],
      },
    });

    expect(result.type).toBe('payment.succeeded');
    expect(result.orderId).toBe('ord_abc');
  });
});

describe('paypalProvider amounts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PAYPAL_CLIENT_ID', 'client');
    vi.stubEnv('PAYPAL_CLIENT_SECRET', 'secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubPayPalFetch(body) {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        String(url).endsWith('/v1/oauth2/token')
          ? { access_token: 'tok', expires_in: 3600 }
          : body,
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function sentAmount(fetchMock) {
    const [, init] = fetchMock.mock.calls.at(-1);
    return JSON.parse(init.body);
  }

  it('sends zero-decimal order amounts without decimals', async () => {
    const fetchMock = stubPayPalFetch({
      id: 'pp_1',
      links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
    });
    const { paypalProvider: provider } =
      await import('#/core/payments/paypal/index.server');

    await provider.createCheckoutSession({
      amountCents: 100000,
      currency: 'JPY',
      orderId: 'ord_1',
      successUrl: '/ok',
      cancelUrl: '/no',
    });

    expect(sentAmount(fetchMock).purchase_units[0].amount).toEqual({
      currency_code: 'JPY',
      value: '1000',
    });
  });

  it('sends refund amounts at the currency precision', async () => {
    const fetchMock = stubPayPalFetch({ id: 'rf_1', status: 'COMPLETED' });
    const { paypalProvider: provider } =
      await import('#/core/payments/paypal/index.server');

    await provider.createRefund({
      paymentIntentId: 'cap_1',
      amountCents: 1999,
      currency: 'USD',
    });

    expect(sentAmount(fetchMock).amount).toEqual({
      value: '19.99',
      currency_code: 'USD',
    });
  });
});
