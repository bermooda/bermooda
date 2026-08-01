// app/core/orders/payment-handlers.server.js
// Domain-event subscribers for payment lifecycle → order status.

import logger from '#/utils/logger.server';
import { emit } from '#/core/events/index.server';
import { cancelOrder, updateOrderStatus } from '#/core/orders/admin.server';

/**
 * Register domain-event subscribers for payment lifecycle events.
 * Called once from bootstrap.server.js.
 *
 * W0-4:
 *   payment.succeeded → mark order 'confirmed' + emit order.confirmed
 *   payment.failed    → cancel order (restores inventory) + mark 'cancelled'
 *
 * @param {{ on: Function }} events
 */
export function registerPaymentEventHandlers({ on }) {
  on('payment.succeeded', async (payload) => {
    if (!payload.orderId) return;
    try {
      await updateOrderStatus(payload.orderId, 'confirmed');
      await emit('order.confirmed', {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
      });
      logger.info(
        { orderId: payload.orderId },
        'payment.succeeded → order confirmed'
      );
    } catch (err) {
      logger.error(
        { err, orderId: payload.orderId },
        'Failed to confirm order on payment.succeeded'
      );
    }
  });

  on('payment.failed', async (payload) => {
    if (!payload.orderId) return;
    try {
      await cancelOrder(payload.orderId);
      logger.info(
        { orderId: payload.orderId },
        'payment.failed → order cancelled'
      );
    } catch (err) {
      logger.error(
        { err, orderId: payload.orderId },
        'Failed to cancel order on payment.failed'
      );
    }
  });
}
