// BNPL payment provider stub (Klarna-style — redirects to manual pending flow).

import logger from '#/utils/logger.server';

const log = logger.child({ provider: 'klarna' });

export const klarnaProvider = {
  name: 'Klarna (Buy now, pay later)',
  requiresRedirect: true,

  /**
   * @param {{ orderId?: string, amountCents?: number, currency?: string, successUrl: string, cancelUrl: string }} params
   * @returns {Promise<{ id: string, url: string }>}
   */
  async createCheckoutSession({
    orderId,
    amountCents,
    currency,
    successUrl,
    cancelUrl,
  }) {
    const apiKey = process.env.KLARNA_API_KEY;
    if (!apiKey) {
      log.warn({ orderId }, 'Klarna API key missing — returning dev fallback');
      return {
        id: `klarna_stub_${orderId ?? 'unknown'}`,
        url: successUrl,
      };
    }

    log.info(
      { orderId, amountCents, currency, cancelUrl },
      'Klarna checkout session stub'
    );

    return {
      id: `klarna_${orderId}`,
      url: successUrl,
    };
  },

  async verifyWebhook(request) {
    const rawBody = await request.text();
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new Error('Invalid Klarna webhook payload');
    }

    if (!event?.id) {
      throw new Error('Invalid Klarna webhook payload');
    }

    return { event, rawBody };
  },

  async handleWebhookEvent(event) {
    log.info({ eventId: event.id }, 'Unhandled Klarna webhook event');
    return { type: 'payment.other' };
  },
};
