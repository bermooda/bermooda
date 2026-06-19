// app/core/discounts/promotions.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    discount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    cartDiscount: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  applyStackingRules,
  calculateDiscountAmount,
  resolvePromotions,
} from '#/core/discounts/index.server';

function makeDiscount(overrides = {}) {
  return {
    id: 'disc_1',
    code: 'SAVE10',
    type: 'percent',
    value: 10,
    minSubtotalCents: null,
    minQuantity: null,
    maxUsesCount: null,
    usedCount: 0,
    currency: null,
    startsAt: null,
    expiresAt: null,
    automatic: false,
    stackable: false,
    priority: 0,
    customerGroupId: null,
    rulesJson: null,
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.cartDiscount.findMany.mockResolvedValue([]);
});

describe('calculateDiscountAmount', () => {
  it('calculates percent discount', () => {
    const result = calculateDiscountAmount(
      makeDiscount({ type: 'percent', value: 20 }),
      1000
    );
    expect(result.discountCents).toBe(200);
    expect(result.freeShipping).toBe(false);
  });

  it('returns freeShipping for free_shipping type', () => {
    const result = calculateDiscountAmount(
      makeDiscount({ type: 'free_shipping', value: 0 }),
      1000
    );
    expect(result.freeShipping).toBe(true);
  });

  it('calculates BOGO discount on cheapest line', () => {
    const lines = [
      { priceCentsSnapshot: 1000, quantity: 1 },
      { priceCentsSnapshot: 500, quantity: 2 },
    ];
    const result = calculateDiscountAmount(
      makeDiscount({
        type: 'bogo',
        rulesJson: JSON.stringify({
          buyQuantity: 1,
          getQuantity: 1,
          getDiscountPercent: 100,
        }),
      }),
      2000,
      lines
    );
    expect(result.discountCents).toBe(500);
  });
});

describe('applyStackingRules', () => {
  it('picks best non-stackable discount only', () => {
    const candidates = [
      {
        discountId: 'a',
        code: 'A',
        type: 'percent',
        value: 10,
        discountCents: 100,
        stackable: false,
        priority: 0,
      },
      {
        discountId: 'b',
        code: 'B',
        type: 'fixed',
        value: 200,
        discountCents: 200,
        stackable: false,
        priority: 0,
      },
    ];

    const result = applyStackingRules(candidates, 1000);
    expect(result.discountCents).toBe(200);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].code).toBe('B');
  });

  it('accumulates stackable discounts by priority', () => {
    const candidates = [
      {
        discountId: 'a',
        code: 'A',
        type: 'fixed',
        value: 100,
        discountCents: 100,
        stackable: true,
        priority: 1,
        freeShipping: false,
      },
      {
        discountId: 'b',
        code: 'B',
        type: 'fixed',
        value: 50,
        discountCents: 50,
        stackable: true,
        priority: 2,
        freeShipping: false,
      },
    ];

    const result = applyStackingRules(candidates, 1000);
    expect(result.discountCents).toBe(150);
    expect(result.applied).toHaveLength(2);
  });
});

describe('resolvePromotions', () => {
  it('combines automatic and coupon discounts', async () => {
    prisma.discount.findMany
      .mockResolvedValueOnce([
        makeDiscount({
          id: 'auto_1',
          code: 'AUTO10',
          automatic: true,
          type: 'percent',
          value: 10,
          stackable: true,
        }),
      ])
      .mockResolvedValueOnce([
        makeDiscount({
          id: 'code_1',
          code: 'EXTRA5',
          type: 'fixed',
          value: 50,
          stackable: true,
        }),
      ]);

    const cart = {
      currency: 'USD',
      lines: [{ priceCentsSnapshot: 1000, quantity: 2 }],
    };

    const result = await resolvePromotions({
      cart,
      couponCode: 'EXTRA5',
    });

    expect(result.discountCents).toBe(250);
    expect(result.applied.length).toBeGreaterThanOrEqual(1);
  });

  it('applies automatic free shipping', async () => {
    prisma.discount.findMany
      .mockResolvedValueOnce([
        makeDiscount({
          id: 'ship_1',
          code: 'FREESHIP',
          automatic: true,
          type: 'free_shipping',
          value: 0,
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await resolvePromotions({
      cart: { currency: 'USD', lines: [{ priceCentsSnapshot: 500, quantity: 1 }] },
    });

    expect(result.freeShipping).toBe(true);
  });
});
