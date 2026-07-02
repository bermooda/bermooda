// BNPL payment provider stub (Klarna-style — redirects to manual pending flow).

import { registerProvider } from '#/core/payments/index.server';

export const klarnaProvider = {
  id: 'klarna',
  name: 'Klarna (Buy now, pay later)',
  supportsHostedCheckout: true,

  async createCheckoutSession({
    orderId,
    orderNumber,
    totalCents,
    currency,
    successUrl,
    cancelUrl,
  }) {
    const apiKey = process.env.KLARNA_API_KEY;
    if (!apiKey) {
      return {
        sessionId: `klarna_stub_${orderId}`,
        redirectUrl: successUrl,
        mode: 'redirect',
        metadata: { orderId, orderNumber, stub: true },
      };
    }

    return {
      sessionId: `klarna_${orderId}`,
      redirectUrl: successUrl,
      mode: 'redirect',
      metadata: { orderId, orderNumber, currency, totalCents, cancelUrl },
    };
  },

  async handleWebhookEvent(_payload) {
    return { handled: false };
  },
};

export function registerKlarnaProvider() {
  registerProvider('klarna', klarnaProvider);
}
