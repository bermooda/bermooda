// app/core/loyalty/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => {
  const prisma = {
    loyaltyTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    referralCode: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    referral: { upsert: vi.fn(), findUnique: vi.fn() },
    order: { findUnique: vi.fn() },
    $transaction: vi.fn((fn) => fn(prisma)),
  };
  return { default: prisma };
});

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
}));

import prisma from '#/libs/prisma.server';

import {
  centsToPoints,
  earnLoyaltyPoints,
  getLoyaltyBalance,
  pointsToCents,
  redeemLoyaltyPoints,
  resolveLoyaltyRedemption,
} from '#/core/loyalty/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loyalty', () => {
  it('pointsToCents converts using redemption rate', () => {
    expect(pointsToCents(100, 100)).toBe(100);
    expect(pointsToCents(50, 100)).toBe(50);
  });

  it('centsToPoints converts using points per dollar', () => {
    expect(centsToPoints(1000, 1)).toBe(10);
    expect(centsToPoints(5000, 2)).toBe(100);
  });

  it('getLoyaltyBalance returns 0 when no transactions', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue(null);
    expect(await getLoyaltyBalance('c1')).toBe(0);
  });

  it('earnLoyaltyPoints rejects invalid amount', async () => {
    await expect(earnLoyaltyPoints('c1', { points: 0 })).rejects.toThrow(
      'INVALID_LOYALTY_POINTS'
    );
  });

  it('redeemLoyaltyPoints rejects insufficient balance', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 10,
    });
    await expect(redeemLoyaltyPoints('c1', { points: 50 })).rejects.toThrow(
      'INSUFFICIENT_LOYALTY_POINTS'
    );
  });

  it('resolveLoyaltyRedemption caps at balance and remaining', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 200,
    });

    const result = await resolveLoyaltyRedemption('c1', 500, 80);
    expect(result.loyaltyPointsCents).toBe(80);
    expect(result.pointsRedeemed).toBe(80);
  });
});
