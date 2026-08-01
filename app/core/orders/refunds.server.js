// app/core/orders/refunds.server.js
// Order refund creation and inventory restore.

import prisma from '#/libs/prisma.server';
import { emitBefore } from '#/core/events/index.server';
import { queueEmit } from '#/core/events/job.server';
import { incrementInventory } from '#/core/inventory/index.server';
import { inventoryItemsFromLines } from '#/core/inventory/items';
import { getProvider } from '#/core/payments/index.server';

/**
 * Restore inventory for tracked order lines.
 * @param {Array<{ variantId?: string|null, quantity: number }>} lines
 */
async function restoreOrderLineInventory(lines = []) {
  const items = inventoryItemsFromLines(lines);
  if (items.length > 0) {
    await incrementInventory(items);
  }
}

/**
 * Create a Refund record for an order.
 *
 * @param {string} orderId
 * @param {{
 *   amountCents: number,
 *   reason?: string,
 *   providerRefundId?: string,
 *   restoreInventory?: boolean,
 * }} data
 * @returns {Promise<object>} created Refund
 */
export async function createRefund(
  orderId,
  { amountCents, reason, providerRefundId, restoreInventory = true } = {}
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  await emitBefore('refund.create', { orderId, order, amountCents, reason });

  let effectiveProviderRefundId = providerRefundId ?? null;

  if (
    !effectiveProviderRefundId &&
    order.paymentIntentId &&
    order.paymentProvider &&
    order.paymentProvider !== 'manual'
  ) {
    const provider = getProvider(order.paymentProvider);
    if (typeof provider.createRefund === 'function') {
      const result = await provider.createRefund({
        paymentIntentId: order.paymentIntentId,
        amountCents,
        reason: reason ?? 'requested_by_customer',
        currency: order.currency,
      });
      effectiveProviderRefundId = result.refundId ?? null;
    }
  }

  const refund = await prisma.refund.create({
    data: {
      orderId,
      amountCents,
      reason: reason ?? null,
      providerRefundId: effectiveProviderRefundId,
    },
  });

  if (restoreInventory) {
    await restoreOrderLineInventory(order.lines);
  }

  await queueEmit('payment.refunded', {
    refundId: refund.id,
    orderId,
    amountCents,
  });

  return refund;
}
