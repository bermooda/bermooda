// app/core/loyalty/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => {
  const prisma = {
    loyaltyTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
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
  getCustomerLoyaltySummary,
  getLoyaltyBalance,
  listLoyaltyTransactions,
  normalizeReferralCode,
  parseLoyaltySettingsInput,
  pointsToCents,
  redeemLoyaltyPoints,
  resolveLoyaltyRedemption,
} from '#/core/loyalty/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  settingsGet.mockResolvedValue(null);
});

describe('parseLoyaltySettingsInput', () => {
  it('parses admin form values', () => {
    expect(
      parseLoyaltySettingsInput({
        enabled: 'on',
        pointsPerDollar: '2',
        redemptionRateCents: '150',
        referralBonusPoints: '250',
      })
    ).toEqual({
      enabled: true,
      pointsPerDollar: 2,
      redemptionRateCents: 150,
      referralBonusPoints: 250,
    });
  });

  it('treats unchecked enabled as false', () => {
    expect(parseLoyaltySettingsInput({ enabled: null }).enabled).toBe(false);
  });

  it('ignores invalid numeric fields', () => {
    expect(parseLoyaltySettingsInput({ redemptionRateCents: '0' })).toEqual({});
  });
});

describe('normalizeReferralCode', () => {
  it('trims and uppercases referral codes', () => {
    expect(normalizeReferralCode(' abc123 ')).toBe('ABC123');
  });
});

describe('loyalty conversions', () => {
  it('pointsToCents converts using redemption rate', () => {
    expect(pointsToCents(100, 100)).toBe(100);
    expect(pointsToCents(50, 100)).toBe(50);
  });

  it('centsToPoints converts using points per dollar', () => {
    expect(centsToPoints(1000, 1)).toBe(10);
    expect(centsToPoints(5000, 2)).toBe(100);
  });
});

describe('getLoyaltyBalance', () => {
  it('returns 0 when no transactions', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue(null);
    expect(await getLoyaltyBalance('c1')).toBe(0);
  });
});

describe('getCustomerLoyaltySummary', () => {
  it('returns zeroed summary without a customer id', async () => {
    const summary = await getCustomerLoyaltySummary();
    expect(summary).toEqual({
      config: expect.objectContaining({ enabled: true }),
      balance: 0,
      enabled: false,
      valueCents: 0,
    });
  });

  it('computes redeemable value when enabled', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 200,
    });

    const summary = await getCustomerLoyaltySummary('c1');
    expect(summary.balance).toBe(200);
    expect(summary.enabled).toBe(true);
    expect(summary.valueCents).toBe(200);
  });

  it('returns zero value when loyalty is disabled', async () => {
    settingsGet.mockResolvedValue({ enabled: false });
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 200,
    });

    const summary = await getCustomerLoyaltySummary('c1');
    expect(summary.enabled).toBe(false);
    expect(summary.valueCents).toBe(0);
  });
});

describe('listLoyaltyTransactions', () => {
  it('returns paginated transactions with total', async () => {
    prisma.loyaltyTransaction.findMany.mockResolvedValue([{ id: 'tx1' }]);
    prisma.loyaltyTransaction.count.mockResolvedValue(3);

    const result = await listLoyaltyTransactions('c1', { page: 2, limit: 10 });

    expect(result).toEqual({ transactions: [{ id: 'tx1' }], total: 3 });
    expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: { customerId: 'c1' },
      })
    );
  });
});

describe('earnLoyaltyPoints', () => {
  it('rejects invalid amount', async () => {
    await expect(earnLoyaltyPoints('c1', { points: 0 })).rejects.toThrow(
      'INVALID_LOYALTY_POINTS'
    );
  });
});

describe('redeemLoyaltyPoints', () => {
  it('rejects insufficient balance', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 10,
    });
    await expect(redeemLoyaltyPoints('c1', { points: 50 })).rejects.toThrow(
      'INSUFFICIENT_LOYALTY_POINTS'
    );
  });
});

describe('resolveLoyaltyRedemption', () => {
  it('caps at balance and remaining', async () => {
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({
      balanceAfter: 200,
    });

    const result = await resolveLoyaltyRedemption('c1', 500, 80);
    expect(result.loyaltyPointsCents).toBe(80);
    expect(result.pointsRedeemed).toBe(80);
  });
});
