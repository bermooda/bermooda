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
});
