// app/core/payments/paypal.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
