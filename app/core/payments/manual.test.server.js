// app/core/payments/manual.test.server.js

import { describe, expect, it } from 'vitest';

import { manualProvider } from '#/core/payments/manual.server';

describe('manualProvider', () => {
  it('does not require redirect', () => {
    expect(manualProvider.requiresRedirect).toBe(false);
  });

  it('returns manual checkout session pointing to success URL', async () => {
    const result = await manualProvider.createCheckoutSession({
      orderId: 'ord_1',
      successUrl: 'https://example.com/thank-you',
    });

    expect(result.manual).toBe(true);
    expect(result.url).toBe('https://example.com/thank-you');
  });
});
