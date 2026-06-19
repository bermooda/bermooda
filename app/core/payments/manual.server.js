// app/core/payments/manual.server.js
// Manual/offline payment provider — bank transfer, COD, pay-on-invoice.

import logger from '#/utils/logger.server';

const log = logger.child({ provider: 'manual' });

/**
 * Manual payment provider.
 * Places orders in pending_payment for admin confirmation — no redirect or webhook.
 */
export const manualProvider = {
  name: 'Bank Transfer / Pay on Invoice',
  requiresRedirect: false,

  /**
   * @param {{ orderId?: string, successUrl: string }} params
   * @returns {Promise<{ url: string, manual: true, orderId?: string }>}
   */
  async createCheckoutSession({ orderId, successUrl }) {
    log.info({ orderId }, 'Manual payment — no redirect required');
    return { url: successUrl, manual: true, orderId };
  },

  async verifyWebhook() {
    throw new Error('Manual provider does not support webhooks');
  },

  async handleWebhookEvent() {
    return { type: 'payment.other' };
  },

  async createRefund() {
    throw new Error('Manual refunds are processed in admin');
  },
};
