// app/core/loyalty/index.server.js
// Loyalty points ledger, redemption, and referral rewards.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

const DEFAULT_CONFIG = {
  enabled: true,
  pointsPerDollar: 1,
  redemptionRateCents: 100,
  referralBonusPoints: 500,
};

export async function getLoyaltyConfig() {
  const stored = await settingsGet('loyalty');
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) };
}

export async function getLoyaltyBalance(customerId) {
  const latest = await prisma.loyaltyTransaction.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

export function pointsToCents(points, redemptionRateCents) {
  return Math.floor((points * redemptionRateCents) / 100);
}

export function centsToPoints(cents, pointsPerDollar) {
  return Math.floor((cents / 100) * pointsPerDollar);
}

export async function listLoyaltyTransactions(
  customerId,
  { page = 1, limit = 50 } = {}
) {
  const skip = (page - 1) * limit;
  return prisma.loyaltyTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} customerId
 */
async function getBalanceInTransaction(tx, customerId) {
  const latest = await tx.loyaltyTransaction.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
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
  const currentBalance = tx
    ? await getBalanceInTransaction(client, customerId)
    : await getLoyaltyBalance(customerId);
  const balanceAfter = currentBalance + points;

  const entry = await client.loyaltyTransaction.create({
    data: {
      customerId,
      points,
      balanceAfter,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });

  logger.info({ customerId, points, balanceAfter }, 'Loyalty points earned');
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
  const currentBalance = tx
    ? await getBalanceInTransaction(client, customerId)
    : await getLoyaltyBalance(customerId);

  if (currentBalance < points) {
    throw new Error('INSUFFICIENT_LOYALTY_POINTS');
  }

  const balanceAfter = currentBalance - points;

  const entry = await client.loyaltyTransaction.create({
    data: {
      customerId,
      points: -points,
      balanceAfter,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });

  logger.info({ customerId, points, balanceAfter }, 'Loyalty points redeemed');
  return entry;
}

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

export async function getReferralCodeByCode(code) {
  if (!code) return null;
  return prisma.referralCode.findUnique({
    where: { code: code.trim().toUpperCase() },
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

export async function updateLoyaltySettings(settings) {
  const current = await getLoyaltyConfig();
  await settingsSet('loyalty', { ...current, ...settings });
}
