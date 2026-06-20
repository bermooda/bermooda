// app/core/back-in-stock/index.server.js
// Back-in-stock subscriptions and notifications.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { sendBackInStockEmail } from '#/emails/index.server';

export async function subscribeBackInStock({
  variantId,
  email,
  customerId,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('EMAIL_REQUIRED');
  }

  return prisma.backInStockSubscription.upsert({
    where: {
      variantId_email: { variantId, email: normalizedEmail },
    },
    create: {
      variantId,
      email: normalizedEmail,
      customerId: customerId ?? null,
      notifiedAt: null,
    },
    update: {
      customerId: customerId ?? null,
      notifiedAt: null,
    },
  });
}

export async function listBackInStockSubscriptions(variantId) {
  return prisma.backInStockSubscription.findMany({
    where: { variantId, notifiedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Notify subscribers when a variant is back in stock.
 */
export async function notifyBackInStockSubscribers(variantId) {
  const subscriptions = await listBackInStockSubscriptions(variantId);
  if (!subscriptions.length) return { notified: 0 };

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant) return { notified: 0 };

  let notified = 0;
  for (const sub of subscriptions) {
    try {
      await sendBackInStockEmail({
        to: sub.email,
        variant,
      });
      await prisma.backInStockSubscription.update({
        where: { id: sub.id },
        data: { notifiedAt: new Date() },
      });
      notified += 1;
    } catch (err) {
      logger.error(
        { err, subscriptionId: sub.id, variantId },
        'Back-in-stock notification failed'
      );
    }
  }

  return { notified };
}

/**
 * Register inventory.restocked subscriber.
 * @param {{ on: Function }} bus
 */
export function registerBackInStockSubscribers({ on }) {
  on('inventory.restocked', async ({ variantId }) => {
    await notifyBackInStockSubscribers(variantId);
  });
}
