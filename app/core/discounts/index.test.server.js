// app/core/discounts/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    discount: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  applyDiscount,
  validateDiscount,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  listDiscounts,
} from './index.server.js';

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
    maxUsesCount: null,
    usedCount: 0,
    currency: null,
    expiresAt: null,
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// applyDiscount — error paths
// ---------------------------------------------------------------------------

describe('applyDiscount — DISCOUNT_INACTIVE', () => {
  it('throws when discount.active is false', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ active: false })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_INACTIVE');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });
});

describe('applyDiscount — DISCOUNT_EXPIRED', () => {
  it('throws when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000);
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ expiresAt: pastDate })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_EXPIRED');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });

  it('does not throw when expiresAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ expiresAt: futureDate })
    );
    prisma.discount.update.mockResolvedValue({});

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).resolves.not.toThrow();
  });
});

describe('applyDiscount — DISCOUNT_MAX_USES_REACHED', () => {
  it('throws when usedCount equals maxUsesCount', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ maxUsesCount: 5, usedCount: 5 })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_MAX_USES_REACHED');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });

  it('throws when usedCount exceeds maxUsesCount', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ maxUsesCount: 5, usedCount: 7 })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_MAX_USES_REACHED');
  });
});

describe('applyDiscount — DISCOUNT_MIN_SUBTOTAL_NOT_MET', () => {
  it('throws when subtotalCents is below minSubtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ minSubtotalCents: 5000 })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 4999, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_MIN_SUBTOTAL_NOT_MET');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });

  it('does not throw when subtotalCents equals minSubtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ minSubtotalCents: 5000 })
    );
    prisma.discount.update.mockResolvedValue({});

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 5000, currency: 'USD' })
    ).resolves.not.toThrow();
  });
});

describe('applyDiscount — DISCOUNT_CURRENCY_MISMATCH', () => {
  it('throws when discount currency does not match params currency', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ currency: 'EUR' })
    );

    await expect(
      applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_CURRENCY_MISMATCH');

    expect(prisma.discount.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyDiscount — calculation
// ---------------------------------------------------------------------------

describe('applyDiscount — percent calculation', () => {
  it('calculates correct discountCents for percent type', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'percent', value: 20 })
    );
    prisma.discount.update.mockResolvedValue({});

    const result = await applyDiscount('SAVE10', {
      subtotalCents: 1000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(200); // 20% of 1000
  });

  it('rounds fractional percent discounts', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'percent', value: 10 })
    );
    prisma.discount.update.mockResolvedValue({});

    const result = await applyDiscount('SAVE10', {
      subtotalCents: 999,
      currency: 'USD',
    });

    // 10% of 999 = 99.9 → rounds to 100
    expect(result.discountCents).toBe(100);
  });
});

describe('applyDiscount — fixed calculation caps at subtotal', () => {
  it('caps fixed discount at subtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'fixed', value: 5000 })
    );
    prisma.discount.update.mockResolvedValue({});

    // subtotal is 2000 but discount value is 5000 — should be capped at 2000
    const result = await applyDiscount('FLAT50', {
      subtotalCents: 2000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(2000);
  });

  it('uses full fixed value when it is less than subtotalCents', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ type: 'fixed', value: 500 })
    );
    prisma.discount.update.mockResolvedValue({});

    const result = await applyDiscount('FLAT5', {
      subtotalCents: 2000,
      currency: 'USD',
    });

    expect(result.discountCents).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// applyDiscount — atomic usedCount increment
// ---------------------------------------------------------------------------

describe('applyDiscount — atomic usedCount increment', () => {
  it('uses { increment: 1 } for usedCount, not usedCount + 1', async () => {
    const discount = makeDiscount({ usedCount: 3 });
    prisma.discount.findFirst.mockResolvedValue(discount);
    prisma.discount.update.mockResolvedValue({});

    await applyDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' });

    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { id: discount.id },
      data: { usedCount: { increment: 1 } },
    });

    // Verify it is NOT called with a hardcoded number
    const callArg = prisma.discount.update.mock.calls[0][0];
    expect(typeof callArg.data.usedCount).toBe('object');
    expect(callArg.data.usedCount).toEqual({ increment: 1 });
    expect(callArg.data.usedCount).not.toBe(4);
  });
});

// ---------------------------------------------------------------------------
// applyDiscount — return shape
// ---------------------------------------------------------------------------

describe('applyDiscount — return value', () => {
  it('returns { discountCents, code, type, value }', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ code: 'SAVE10', type: 'percent', value: 10 })
    );
    prisma.discount.update.mockResolvedValue({});

    const result = await applyDiscount('SAVE10', {
      subtotalCents: 1000,
      currency: 'USD',
    });

    expect(result).toEqual({
      discountCents: 100,
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });
  });
});

// ---------------------------------------------------------------------------
// validateDiscount — does NOT call prisma update
// ---------------------------------------------------------------------------

describe('validateDiscount', () => {
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

  it('still validates — throws DISCOUNT_INACTIVE without updating', async () => {
    prisma.discount.findFirst.mockResolvedValue(
      makeDiscount({ active: false })
    );

    await expect(
      validateDiscount('SAVE10', { subtotalCents: 1000, currency: 'USD' })
    ).rejects.toThrow('DISCOUNT_INACTIVE');

    expect(prisma.discount.update).not.toHaveBeenCalled();
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
  it('returns all discounts with no filter', async () => {
    prisma.discount.findMany.mockResolvedValue([makeDiscount()]);

    const result = await listDiscounts();

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(result).toHaveLength(1);
  });

  it('filters by active when provided', async () => {
    prisma.discount.findMany.mockResolvedValue([]);

    await listDiscounts({ active: true });

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
  });

  it('applies pagination via page and limit', async () => {
    prisma.discount.findMany.mockResolvedValue([]);

    await listDiscounts({ page: 3, limit: 5 });

    expect(prisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });
});
