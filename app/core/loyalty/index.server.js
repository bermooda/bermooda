// app/core/loyalty/index.server.js
// Loyalty points ledger, redemption, and referral rewards.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  enabled: true,
  pointsPerDollar: 1,
  redemptionRateCents: 100,
  referralBonusPoints: 500,
};

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export async function getLoyaltyConfig() {
  const stored = await settingsGet('loyalty');
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) };
}

/**
 * Parse admin/API loyalty settings payload.
 *
 * @param {object} input
 * @returns {object}
 */
export function parseLoyaltySettingsInput(input = {}) {
  const parsed = {};

  if ('enabled' in input) {
    parsed.enabled =
      input.enabled === true ||
      input.enabled === 'on' ||
      input.enabled === 'true';
  }

  if (input.pointsPerDollar !== undefined && input.pointsPerDollar !== null) {
    const pointsPerDollar = parseInt(String(input.pointsPerDollar), 10);
    if (Number.isFinite(pointsPerDollar) && pointsPerDollar >= 0) {
      parsed.pointsPerDollar = pointsPerDollar;
    }
  }

  if (
    input.redemptionRateCents !== undefined &&
    input.redemptionRateCents !== null
  ) {
    const redemptionRateCents = parseInt(String(input.redemptionRateCents), 10);
    if (Number.isFinite(redemptionRateCents) && redemptionRateCents > 0) {
      parsed.redemptionRateCents = redemptionRateCents;
    }
  }

  if (
    input.referralBonusPoints !== undefined &&
    input.referralBonusPoints !== null
  ) {
    const referralBonusPoints = parseInt(String(input.referralBonusPoints), 10);
    if (Number.isFinite(referralBonusPoints) && referralBonusPoints >= 0) {
      parsed.referralBonusPoints = referralBonusPoints;
    }
  }

  return parsed;
}

export async function updateLoyaltySettings(settings) {
  const current = await getLoyaltyConfig();
  await settingsSet('loyalty', { ...current, ...settings });
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

export function pointsToCents(points, redemptionRateCents) {
  return Math.floor((points * redemptionRateCents) / 100);
}

export function centsToPoints(cents, pointsPerDollar) {
  return Math.floor((cents / 100) * pointsPerDollar);
}

// ---------------------------------------------------------------------------
// Balance + ledger
// ---------------------------------------------------------------------------

/**
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} client
 * @param {string} customerId
 */
async function resolveCurrentBalance(client, customerId) {
  const latest = await client.loyaltyTransaction.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

export async function getLoyaltyBalance(customerId) {
  return resolveCurrentBalance(prisma, customerId);
}

/**
 * Load a customer's loyalty balance and redeemable value.
 *
 * @param {string} [customerId]
 * @returns {Promise<{ config: object, balance: number, enabled: boolean, valueCents: number }>}
 */
export async function getCustomerLoyaltySummary(customerId) {
  const config = await getLoyaltyConfig();
  if (!customerId) {
    return { config, balance: 0, enabled: false, valueCents: 0 };
  }

  const balance = await getLoyaltyBalance(customerId);
  const enabled = config.enabled;
  const valueCents = enabled
    ? pointsToCents(balance, config.redemptionRateCents)
    : 0;

  return { config, balance, enabled, valueCents };
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} client
 * @param {string} customerId
 * @param {{ points: number, reason?: string, referenceType?: string, referenceId?: string }} params
 */
async function appendLoyaltyTransaction(
  client,
  customerId,
  { points, reason, referenceType, referenceId }
) {
  const balanceAfter =
    (await resolveCurrentBalance(client, customerId)) + points;

  return client.loyaltyTransaction.create({
    data: {
      customerId,
      points,
      balanceAfter,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });
}

/**
 * List loyalty transactions with pagination.
 *
 * @param {string} customerId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ transactions: object[], total: number }>}
 */
export async function listLoyaltyTransactions(
  customerId,
  { page = 1, limit = 50 } = {}
) {
  const skip = (page - 1) * limit;
  const where = { customerId };

  const [transactions, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loyaltyTransaction.count({ where }),
  ]);

  return { transactions, total };
}

export async function earnLoyaltyPoints(
  customerId,
  { points, reason, referenceType, referenceId },
  tx
) {
  if (!points || points <= 0) {
    throw new Error('INVALID_LOYALTY_POINTS');
  }

  const client = tx ?? prisma;
  const entry = await appendLoyaltyTransaction(client, customerId, {
    points,
    reason,
    referenceType,
    referenceId,
  });

  logger.info(
    { customerId, points, balanceAfter: entry.balanceAfter },
    'Loyalty points earned'
  );
  return entry;
}

export async function redeemLoyaltyPoints(
  customerId,
  { points, reason, referenceType, referenceId },
  tx
) {
  if (!points || points <= 0) {
    throw new Error('INVALID_LOYALTY_REDEMPTION');
  }

  const client = tx ?? prisma;
  const currentBalance = await resolveCurrentBalance(client, customerId);

  if (currentBalance < points) {
    throw new Error('INSUFFICIENT_LOYALTY_POINTS');
  }

  const entry = await appendLoyaltyTransaction(client, customerId, {
    points: -points,
    reason,
    referenceType,
    referenceId,
  });

  logger.info(
    { customerId, points, balanceAfter: entry.balanceAfter },
    'Loyalty points redeemed'
  );
  return entry;
}

// ---------------------------------------------------------------------------
// Checkout redemption
// ---------------------------------------------------------------------------

/**
 * Resolve loyalty discount cents from requested points.
 */
export async function resolveLoyaltyRedemption(
  customerId,
  requestedPointsCents,
  remainingCents
) {
  const config = await getLoyaltyConfig();
  if (!config.enabled || !customerId || requestedPointsCents <= 0) {
    return { loyaltyPointsCents: 0, pointsRedeemed: 0 };
  }

  const balance = await getLoyaltyBalance(customerId);
  const maxCentsFromPoints = pointsToCents(balance, config.redemptionRateCents);
  const loyaltyPointsCents = Math.min(
    requestedPointsCents,
    maxCentsFromPoints,
    Math.max(0, remainingCents)
  );

  const pointsRedeemed =
    loyaltyPointsCents > 0
      ? Math.ceil((loyaltyPointsCents * 100) / config.redemptionRateCents)
      : 0;

  return { loyaltyPointsCents, pointsRedeemed };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

/**
 * Normalize a referral code for lookup and storage.
 *
 * @param {string} code
 * @returns {string}
 */
export function normalizeReferralCode(code) {
  return code.trim().toUpperCase();
}

function generateCodeFromId(customerId) {
  return customerId.slice(-8).toUpperCase();
}

export async function getOrCreateReferralCode(customerId) {
  const existing = await prisma.referralCode.findUnique({
    where: { customerId },
  });
  if (existing) return existing;

  let code = generateCodeFromId(customerId);
  let suffix = 0;
  while (await prisma.referralCode.findUnique({ where: { code } })) {
    suffix += 1;
    code = `${generateCodeFromId(customerId)}${suffix}`;
  }

  return prisma.referralCode.create({
    data: { customerId, code },
  });
}

async function getReferralCodeByCode(code) {
  if (!code) return null;
  return prisma.referralCode.findUnique({
    where: { code: normalizeReferralCode(code) },
    include: { customer: { select: { id: true, email: true } } },
  });
}

export async function trackReferral(referralCode, referredCustomerId) {
  const ref = await getReferralCodeByCode(referralCode);
  if (!ref) return null;
  if (ref.customerId === referredCustomerId) {
    throw new Error('SELF_REFERRAL_NOT_ALLOWED');
  }

  return prisma.referral.upsert({
    where: { referredCustomerId },
    create: {
      referralCodeId: ref.id,
      referredCustomerId,
    },
    update: {},
  });
}

async function processReferralReward(orderId, customerId) {
  const referral = await prisma.referral.findUnique({
    where: { referredCustomerId: customerId },
    include: { referralCode: true },
  });
  if (!referral || referral.rewardGrantedAt) return;

  const config = await getLoyaltyConfig();
  if (!config.enabled || config.referralBonusPoints <= 0) return;

  await prisma.$transaction(async (tx) => {
    await earnLoyaltyPoints(
      referral.referralCode.customerId,
      {
        points: config.referralBonusPoints,
        reason: 'Referral bonus',
        referenceType: 'referral',
        referenceId: referral.id,
      },
      tx
    );
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        firstOrderId: orderId,
        rewardGrantedAt: new Date(),
      },
    });
  });

  logger.info(
    { orderId, referrerId: referral.referralCode.customerId },
    'Referral reward granted'
  );
}

async function earnOrderLoyaltyPoints(orderId, customerId, totalCents) {
  const config = await getLoyaltyConfig();
  if (!config.enabled || !customerId) return;

  const points = centsToPoints(totalCents, config.pointsPerDollar);
  if (points <= 0) return;

  await earnLoyaltyPoints(customerId, {
    points,
    reason: 'Order purchase',
    referenceType: 'order',
    referenceId: orderId,
  });
}

// ---------------------------------------------------------------------------
// Event subscribers
// ---------------------------------------------------------------------------

/**
 * Register loyalty event subscribers.
 * @param {{ on: Function }} bus
 */
export function registerLoyaltySubscribers({ on }) {
  on('order.confirmed', async ({ orderId }) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, totalCents: true },
    });
    if (!order?.customerId) return;

    try {
      await earnOrderLoyaltyPoints(
        order.id,
        order.customerId,
        order.totalCents
      );
      await processReferralReward(order.id, order.customerId);
    } catch (err) {
      logger.error({ err, orderId }, 'Loyalty earn on order.confirmed failed');
    }
  });
}
