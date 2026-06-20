// app/core/pricing/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    variantPrice: { findUnique: vi.fn() },
    priceList: { findMany: vi.fn() },
    customerGroupMember: { findMany: vi.fn() },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  getCustomerGroupIds,
  resolveVariantPrice,
} from '#/core/pricing/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveVariantPrice', () => {
  it('returns base price when no price lists apply', async () => {
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 1000 });
    prisma.priceList.findMany.mockResolvedValue([]);

    const result = await resolveVariantPrice({
      variantId: 'v1',
      currency: 'USD',
      quantity: 1,
    });

    expect(result).toEqual({ priceCents: 1000, source: 'base' });
  });

  it('uses lower price list entry for matching customer group', async () => {
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 1000 });
    prisma.priceList.findMany.mockResolvedValue([
      {
        id: 'pl1',
        active: true,
        startsAt: null,
        expiresAt: null,
        entries: [{ priceCents: 800 }],
      },
    ]);

    const result = await resolveVariantPrice({
      variantId: 'v1',
      currency: 'USD',
      quantity: 2,
      customerGroupIds: ['g1'],
    });

    expect(result).toEqual({
      priceCents: 800,
      source: 'price_list',
      priceListId: 'pl1',
    });
  });
});

describe('getCustomerGroupIds', () => {
  it('returns empty array without customerId', async () => {
    expect(await getCustomerGroupIds()).toEqual([]);
  });

  it('returns group ids for a customer', async () => {
    prisma.customerGroupMember.findMany.mockResolvedValue([
      { customerGroupId: 'g1' },
      { customerGroupId: 'g2' },
    ]);

    expect(await getCustomerGroupIds('cust-1')).toEqual(['g1', 'g2']);
  });
});
