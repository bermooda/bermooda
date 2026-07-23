// app/core/discounts/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    discount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  validateDiscount,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  listDiscounts,
  parseDiscountFormData,
  toggleDiscountActive,
  applyStackingRules,
  calculateDiscountAmount,
  isDiscountActive,
  resolvePromotions,
} from '#/core/discounts/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// validateDiscount — does NOT call prisma update
// ---------------------------------------------------------------------------

describe('validateDiscount', () => {
  it('throws when discount.active is false', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ active: false })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_INACTIVE');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });

  it('throws when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000);
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ expiresAt: pastDate })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_EXPIRED');
  });

  it('throws when usedCount equals maxUsesCount', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ maxUsesCount: 5, usedCount: 5 })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_MAX_USES_REACHED');
  });

  it('throws when subtotalCents is below minSubtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ minSubtotalCents: 5000 })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 4999, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_MIN_SUBTOTAL_NOT_MET');
  });

  it('throws when discount currency does not match params currency', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ currency: 'EUR' })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_CURRENCY_MISMATCH');
  });

  it('calculates correct discountCents for percent type', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'percent', value: 20 })
    );

    const result = await validateDiscount('SAVE10', {
      subtotalCents: 1000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(200);
  });

  it('caps fixed discount at subtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'fixed', value: 5000 })
    );

    const result = await validateDiscount('FLAT50', {
      subtotalCents: 2000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(2000);
  });

  it('does not call prisma.discount.update', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'percent', value: 15 })
    );

    await validateDiscount('SAVE10', { subtotalCents: 2000, currency: 'USD' });

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });

  it('returns discount record with discountCents', async () => {
    const discount = makeDiscount({ type: 'percent', value: 15 });
    prisma.discount.findFirst.mockResolvedValue(discount);

    const result = await validateDiscount('SAVE10', {
      subtotalCents: 2000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(300); // 15% of 2000
    expect(result.code).toBe('SAVE10');
  });
});

// ---------------------------------------------------------------------------
// getDiscount
// ---------------------------------------------------------------------------

describe('getDiscount', () => {
  it('returns null when discount is not found', async () => {
    prisma.discount.findFirst.mockResolvedValue(null);

    const result = await getDiscount('NOPE');

    expect(result).toBeNull();
  });

  it('returns the discount record when found', async () => {
    const discount = makeDiscount();
    prisma.discount.findFirst.mockResolvedValue(discount);

    const result = await getDiscount('SAVE10');

    expect(result).toEqual(discount);
  });
});

// ---------------------------------------------------------------------------
// createDiscount
// ---------------------------------------------------------------------------

describe('createDiscount', () => {
  it('calls prisma.discount.create with provided data', async () => {
    const data = { code: 'NEW20', type: 'percent', value: 20, active: true };
    prisma.discount.create.mockResolvedValue({ id: 'disc_new', ...data });

    const result = await createDiscount(data);

    expect(prisma.discount.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe('disc_new');
  });
});

// ---------------------------------------------------------------------------
// updateDiscount
// ---------------------------------------------------------------------------

describe('updateDiscount', () => {
  it('calls prisma.discount.update with id and data', async () => {
    prisma.discount.update.mockResolvedValue({ id: 'disc_1', active: false });

    await updateDiscount('disc_1', { active: false });

    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { id: 'disc_1' },
      data: { active: false },
    });
  });
});

// ---------------------------------------------------------------------------
// deleteDiscount
// ---------------------------------------------------------------------------

describe('deleteDiscount', () => {
  it('calls prisma.discount.delete with id', async () => {
    prisma.discount.delete.mockResolvedValue({});

    await deleteDiscount('disc_1');

    expect(prisma.discount.delete).toHaveBeenCalledWith({
      where: { id: 'disc_1' },
    });
  });
});

// ---------------------------------------------------------------------------
// listDiscounts
// ---------------------------------------------------------------------------

describe('listDiscounts', () => {
  it('returns discounts and total with no filter', async () => {
    prisma.discount.findMany.mockResolvedValue([makeDiscount()]);
    prisma.discount.count.mockResolvedValue(1);

    const result = await listDiscounts();

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(result.discounts).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by active when provided', async () => {
    prisma.discount.findMany.mockResolvedValue([]);
    prisma.discount.count.mockResolvedValue(0);

    await listDiscounts({ active: true });

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
  });

  it('applies pagination via page and limit', async () => {
    prisma.discount.findMany.mockResolvedValue([]);
    prisma.discount.count.mockResolvedValue(0);

    await listDiscounts({ page: 3, limit: 5 });

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  it('supports custom orderBy', async () => {
    prisma.discount.findMany.mockResolvedValue([]);
    prisma.discount.count.mockResolvedValue(0);

    await listDiscounts({ orderBy: { createdAt: 'desc' } });

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });
});

describe('parseDiscountFormData', () => {
  it('normalizes percent discount fields', () => {
    const formData = new FormData();
    formData.set('code', ' save10 ');
    formData.set('type', 'percent');
    formData.set('value', '15');

    expect(parseDiscountFormData(formData, { active: true })).toEqual({
      data: {
        code: 'SAVE10',
        type: 'percent',
        value: 15,
        minSubtotalCents: null,
        maxUsesCount: null,
        currency: null,
        expiresAt: null,
        active: true,
      },
    });
  });

  it('requires currency for fixed discounts', () => {
    const formData = new FormData();
    formData.set('code', 'FIXED5');
    formData.set('type', 'fixed');
    formData.set('value', '500');

    expect(parseDiscountFormData(formData)).toEqual({
      error: 'Currency is required for fixed discounts.',
    });
  });
});

describe('toggleDiscountActive', () => {
  it('flips the active flag', async () => {
    prisma.discount.findFirst.mockResolvedValue(null);
    prisma.discount.findUnique.mockResolvedValue({ id: 'd1', active: true });
    prisma.discount.update.mockResolvedValue({ id: 'd1', active: false });

    const result = await toggleDiscountActive('d1');

    expect(result).toEqual({ id: 'd1', active: false });
    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { active: false },
    });
  });

  it('throws when discount is missing', async () => {
    prisma.discount.findFirst.mockResolvedValue(null);
    prisma.discount.findUnique.mockResolvedValue(null);

    await expect(toggleDiscountActive('missing')).rejects.toMatchObject({
      code: 'DISCOUNT_NOT_FOUND',
    });
  });
});

// --- promotions (formerly promotions.test.server.js) ---

describe('isDiscountActive', () => {
  it('returns false when discount is inactive', () => {
    expect(isDiscountActive(makeDiscount({ active: false }))).toBe(false);
  });

  it('returns false when discount has not started', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isDiscountActive(makeDiscount({ startsAt: future }))).toBe(false);
  });

  it('returns true for a valid active discount', () => {
    expect(isDiscountActive(makeDiscount())).toBe(true);
  });
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
      cart: {
        currency: 'USD',
        lines: [{ priceCentsSnapshot: 500, quantity: 1 }],
      },
    });

    expect(result.freeShipping).toBe(true);
  });
});
