// app/core/gift-cards/index.server.js
// Gift card issuance and checkout redemption.

import { randomBytes } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

export function generateGiftCardCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Look up an active gift card by code.
 * @param {string} code
 * @param {string} [currency]
 */
export async function getGiftCardByCode(code, currency) {
  const giftCard = await prisma.giftCard.findUnique({
    where: { code: normalizeCode(code) },
  });
  if (!giftCard || giftCard.status !== 'active') return null;
  if (giftCard.expiresAt && giftCard.expiresAt <= new Date()) return null;
  if (currency && giftCard.currency !== currency) return null;
  if (giftCard.balanceCents <= 0) return null;
  return giftCard;
}

/**
 * Issue a new gift card.
 */
export async function issueGiftCard({
  code,
  balanceCents,
  currency = 'USD',
  customerId,
  expiresAt,
}) {
  if (!balanceCents || balanceCents <= 0) {
    throw new Error('INVALID_GIFT_CARD_AMOUNT');
  }

  const giftCard = await prisma.giftCard.create({
    data: {
      code: normalizeCode(code ?? generateGiftCardCode()),
      initialBalanceCents: balanceCents,
      balanceCents,
      currency,
      customerId: customerId ?? null,
      expiresAt: expiresAt ?? null,
      status: 'active',
    },
  });

  logger.info({ giftCardId: giftCard.id, code: giftCard.code }, 'Gift card issued');
  return giftCard;
}

/**
 * Compute redeemable amount for checkout.
 */
export async function resolveGiftCardRedemption(code, currency, maxCents) {
  const giftCard = await getGiftCardByCode(code, currency);
  if (!giftCard) {
    throw new Error('GIFT_CARD_INVALID');
  }
  return {
    giftCard,
    amountCents: Math.min(giftCard.balanceCents, Math.max(0, maxCents)),
  };
}

/**
 * Redeem gift card balance against an order.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function redeemGiftCard(
  giftCardId,
  { amountCents, orderId },
  tx
) {
  if (!amountCents || amountCents <= 0) {
    throw new Error('INVALID_GIFT_CARD_REDEMPTION');
  }

  const client = tx ?? prisma;
  const giftCard = await client.giftCard.findUnique({
    where: { id: giftCardId },
  });
  if (!giftCard || giftCard.status !== 'active') {
    throw new Error('GIFT_CARD_INVALID');
  }
  if (giftCard.balanceCents < amountCents) {
    throw new Error('GIFT_CARD_INSUFFICIENT_BALANCE');
  }

  const balanceAfter = giftCard.balanceCents - amountCents;
  const updated = await client.giftCard.update({
    where: { id: giftCardId },
    data: {
      balanceCents: balanceAfter,
      status: balanceAfter === 0 ? 'redeemed' : 'active',
    },
  });

  await client.giftCardRedemption.create({
    data: {
      giftCardId,
      orderId: orderId ?? null,
      amountCents,
    },
  });

  return updated;
}

export async function listGiftCards({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const [giftCards, total] = await Promise.all([
    prisma.giftCard.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.giftCard.count(),
  ]);
  return { giftCards, total };
}
