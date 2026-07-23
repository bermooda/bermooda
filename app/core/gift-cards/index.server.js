// app/core/gift-cards/index.server.js
// Gift card issuance and checkout redemption.

import { randomBytes } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GIFT_CARD_LIST_INCLUDE = {
  customer: { select: { id: true, email: true, name: true } },
};

// ---------------------------------------------------------------------------
// Code helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a gift card code for lookup and storage.
 *
 * @param {string} code
 * @returns {string}
 */
export function normalizeGiftCardCode(code) {
  return code.trim().toUpperCase();
}

export function generateGiftCardCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Build a Prisma where clause for gift card list search.
 *
 * @param {string} [q]
 * @returns {object}
 */
export function buildGiftCardSearchWhere(q) {
  const query = q?.trim();
  if (!query) return {};

  return { code: containsFilter(normalizeGiftCardCode(query)) };
}

/**
 * Parse admin/API issue payload into normalized gift card fields.
 *
 * @param {object} input
 * @returns {{ code: string|null, balanceCents: number, currency: string, customerId: string|null, expiresAt: Date|null }}
 */
export function parseIssueGiftCardInput(input = {}) {
  const rawCode = input.code?.toString().trim();
  const code = rawCode ? normalizeGiftCardCode(rawCode) : null;

  const balanceCents =
    typeof input.balanceCents === 'number'
      ? input.balanceCents
      : parseInt(String(input.balanceCents ?? '0'), 10);

  const currency = input.currency?.toString().trim().toUpperCase() || 'USD';

  const customerId = input.customerId?.toString().trim() || null;

  let expiresAt = null;
  if (input.expiresAt) {
    const parsed =
      input.expiresAt instanceof Date
        ? input.expiresAt
        : new Date(input.expiresAt);
    if (!Number.isNaN(parsed.getTime())) {
      expiresAt = parsed;
    }
  }

  return { code, balanceCents, currency, customerId, expiresAt };
}

/**
 * @param {object|null|undefined} giftCard
 * @param {{ currency?: string, minBalanceCents?: number }} [options]
 * @returns {boolean}
 */
function isActiveGiftCard(giftCard, { currency, minBalanceCents = 1 } = {}) {
  if (!giftCard || giftCard.status !== 'active') return false;
  if (giftCard.expiresAt && giftCard.expiresAt <= new Date()) return false;
  if (currency && giftCard.currency !== currency) return false;
  if (giftCard.balanceCents < minBalanceCents) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Lookup and issuance
// ---------------------------------------------------------------------------

/**
 * Look up an active gift card by code.
 * @param {string} code
 * @param {string} [currency]
 */
export async function getGiftCardByCode(code, currency) {
  const giftCard = await prisma.giftCard.findUnique({
    where: { code: normalizeGiftCardCode(code) },
  });
  if (!isActiveGiftCard(giftCard, { currency })) return null;
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
  const parsed = parseIssueGiftCardInput({
    code,
    balanceCents,
    currency,
    customerId,
    expiresAt,
  });

  if (!parsed.balanceCents || parsed.balanceCents <= 0) {
    throw new Error('INVALID_GIFT_CARD_AMOUNT');
  }

  const normalizedCode = parsed.code ?? generateGiftCardCode();
  const existing = await prisma.giftCard.findUnique({
    where: { code: normalizedCode },
  });
  if (existing) {
    throw Object.assign(
      new Error('A gift card with that code already exists.'),
      {
        code: 'GIFT_CARD_CODE_EXISTS',
      }
    );
  }

  const giftCard = await prisma.giftCard.create({
    data: {
      code: normalizedCode,
      initialBalanceCents: parsed.balanceCents,
      balanceCents: parsed.balanceCents,
      currency: parsed.currency,
      customerId: parsed.customerId,
      expiresAt: parsed.expiresAt,
      status: 'active',
    },
  });

  logger.info(
    { giftCardId: giftCard.id, code: giftCard.code },
    'Gift card issued'
  );
  return giftCard;
}

/**
 * List gift cards with optional search and pagination.
 *
 * @param {{ page?: number, limit?: number, q?: string }} [options]
 * @returns {Promise<{ giftCards: object[], total: number }>}
 */
export async function listGiftCards({ page = 1, limit = 50, q } = {}) {
  const where = buildGiftCardSearchWhere(q);
  const skip = (page - 1) * limit;

  const [giftCards, total] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: GIFT_CARD_LIST_INCLUDE,
    }),
    prisma.giftCard.count({ where }),
  ]);

  return { giftCards, total };
}

// ---------------------------------------------------------------------------
// Checkout redemption
// ---------------------------------------------------------------------------

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
 * @param {string} giftCardId
 * @param {{ amountCents: number, orderId?: string }} params
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function redeemGiftCard(giftCardId, { amountCents, orderId }, tx) {
  if (!amountCents || amountCents <= 0) {
    throw new Error('INVALID_GIFT_CARD_REDEMPTION');
  }

  const client = tx ?? prisma;
  const giftCard = await client.giftCard.findUnique({
    where: { id: giftCardId },
  });

  if (!isActiveGiftCard(giftCard, { minBalanceCents: amountCents })) {
    throw new Error(
      giftCard?.balanceCents != null && giftCard.balanceCents < amountCents
        ? 'GIFT_CARD_INSUFFICIENT_BALANCE'
        : 'GIFT_CARD_INVALID'
    );
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
