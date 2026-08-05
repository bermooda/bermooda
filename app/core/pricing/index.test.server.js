// app/core/pricing/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    variantPrice: { findUnique: vi.fn(), findMany: vi.fn() },
    priceList: { findMany: vi.fn(), findUnique: vi.fn() },
    customerGroupMember: { findMany: vi.fn() },
    channelPriceOverride: { findMany: vi.fn() },
  },
}));

vi.mock('#/core/channels/index.server', () => ({
  getChannelPriceOverride: vi.fn(),
}));

vi.mock('#/core/catalog/translations.server', () => ({
  loadProductTitleMap: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { getChannelPriceOverride } from '#/core/channels/index.server';
import {
  applyPriceListToCartLines,
  buildPriceListGroupWhere,
  getCustomerGroupIds,
  getPriceList,
  isPriceListActive,
  pickBestVariantPrice,
  resolveCustomerGroupIds,
  resolveVariantPrice,
  resolveVariantPrices,
} from '#/core/pricing/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.variantPrice.findMany.mockResolvedValue([]);
  prisma.channelPriceOverride.findMany.mockResolvedValue([]);
  prisma.priceList.findMany.mockResolvedValue([]);
});

describe('isPriceListActive', () => {
  it('returns false when inactive or outside schedule window', () => {
    const now = new Date('2026-01-15T12:00:00Z');

    expect(isPriceListActive({ active: false }, now)).toBe(false);
    expect(
      isPriceListActive(
        { active: true, startsAt: new Date('2026-02-01T00:00:00Z') },
        now
      )
    ).toBe(false);
    expect(
      isPriceListActive(
        { active: true, expiresAt: new Date('2026-01-01T00:00:00Z') },
        now
      )
    ).toBe(false);
    expect(
      isPriceListActive(
        {
          active: true,
          startsAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-02-01T00:00:00Z'),
        },
        now
      )
    ).toBe(true);
  });
});

describe('buildPriceListGroupWhere', () => {
  it('includes global lists and optional group filters', () => {
    expect(buildPriceListGroupWhere([])).toEqual([{ customerGroupId: null }]);
    expect(buildPriceListGroupWhere(['g1', 'g2'])).toEqual([
      { customerGroupId: null },
      { customerGroupId: { in: ['g1', 'g2'] } },
    ]);
  });
});

describe('pickBestVariantPrice', () => {
  it('prefers the lowest applicable price across sources', () => {
    const result = pickBestVariantPrice({
      basePriceCents: 1000,
      channelPriceCents: 900,
      channelId: 'ch_1',
      priceLists: [
        {
          id: 'pl1',
          active: true,
          startsAt: null,
          expiresAt: null,
          entries: [{ variantId: 'v1', minQuantity: 1, priceCents: 800 }],
        },
      ],
      variantId: 'v1',
      quantity: 2,
    });

    expect(result).toEqual({
      priceCents: 800,
      source: 'price_list',
      priceListId: 'pl1',
      channelId: undefined,
    });
  });

  it('returns channel pricing when no base price exists', () => {
    expect(
      pickBestVariantPrice({
        channelPriceCents: 750,
        channelId: 'ch_1',
        priceLists: [],
        variantId: 'v1',
      })
    ).toEqual({
      priceCents: 750,
      source: 'channel',
      priceListId: undefined,
      channelId: 'ch_1',
    });
  });
});

describe('resolveVariantPrice', () => {
  it('returns base price when no price lists apply', async () => {
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 1000 });
    getChannelPriceOverride.mockResolvedValue(null);
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
    getChannelPriceOverride.mockResolvedValue(null);
    prisma.priceList.findMany.mockResolvedValue([
      {
        id: 'pl1',
        active: true,
        startsAt: null,
        expiresAt: null,
        entries: [{ variantId: 'v1', minQuantity: 1, priceCents: 800 }],
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

  it('uses channel override via channels helper', async () => {
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 1000 });
    getChannelPriceOverride.mockResolvedValue({ priceCents: 850 });
    prisma.priceList.findMany.mockResolvedValue([]);

    const result = await resolveVariantPrice({
      variantId: 'v1',
      currency: 'USD',
      salesChannelId: 'ch_1',
    });

    expect(getChannelPriceOverride).toHaveBeenCalledWith('ch_1', 'v1', 'USD');
    expect(result).toEqual({
      priceCents: 850,
      source: 'channel',
      channelId: 'ch_1',
    });
  });
});

describe('resolveVariantPrices', () => {
  it('batch-resolves prices for multiple lines', async () => {
    prisma.variantPrice.findMany.mockResolvedValue([
      { variantId: 'v1', priceCents: 1000 },
      { variantId: 'v2', priceCents: 500 },
    ]);
    prisma.priceList.findMany.mockResolvedValue([]);

    const result = await resolveVariantPrices(
      [
        { variantId: 'v1', quantity: 1 },
        { variantId: 'v2', quantity: 3 },
      ],
      { currency: 'USD' }
    );

    expect(result.get('v1:1')).toEqual({ priceCents: 1000, source: 'base' });
    expect(result.get('v2:3')).toEqual({ priceCents: 500, source: 'base' });
    expect(prisma.variantPrice.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.priceList.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('applyPriceListToCartLines', () => {
  it('updates line snapshots from batched pricing', async () => {
    prisma.variantPrice.findMany.mockResolvedValue([
      { variantId: 'v1', priceCents: 900 },
    ]);
    prisma.priceList.findMany.mockResolvedValue([]);

    const cart = {
      currency: 'USD',
      lines: [{ variantId: 'v1', quantity: 2, priceCentsSnapshot: 1000 }],
    };

    const priced = await applyPriceListToCartLines(cart, {
      customerGroupIds: ['g1'],
    });

    expect(priced.lines[0].priceCentsSnapshot).toBe(900);
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

describe('resolveCustomerGroupIds', () => {
  it('prefers explicit ids over customer lookup', async () => {
    prisma.customerGroupMember.findMany.mockResolvedValue([
      { customerGroupId: 'g-from-db' },
    ]);

    await expect(
      resolveCustomerGroupIds({
        customerId: 'cust-1',
        customerGroupId: 'g-single',
        customerGroupIds: ['g-explicit'],
      })
    ).resolves.toEqual(['g-explicit']);
  });

  it('falls back to customer groups when no explicit ids provided', async () => {
    prisma.customerGroupMember.findMany.mockResolvedValue([
      { customerGroupId: 'g1' },
    ]);

    await expect(
      resolveCustomerGroupIds({ customerId: 'cust-1' })
    ).resolves.toEqual(['g1']);
  });
});

describe('getPriceList', () => {
  it('returns null when the price list is missing', async () => {
    prisma.priceList.findUnique.mockResolvedValue(null);

    await expect(getPriceList('missing')).resolves.toBeNull();
    expect(loadProductTitleMap).not.toHaveBeenCalled();
  });

  it('attaches translated product titles to entries', async () => {
    prisma.priceList.findUnique.mockResolvedValue({
      id: 'pl1',
      name: 'Wholesale',
      entries: [
        {
          id: 'e1',
          variant: {
            id: 'v1',
            sku: 'SKU-1',
            product: { id: 'p1' },
          },
        },
      ],
      _count: { entries: 1 },
      customerGroup: null,
    });
    loadProductTitleMap.mockResolvedValue(new Map([['p1', 'Blue Shirt']]));

    const result = await getPriceList('pl1');

    expect(loadProductTitleMap).toHaveBeenCalledWith(['p1'], 'en');
    expect(result.entries[0].variant.product).toEqual({
      id: 'p1',
      title: 'Blue Shirt',
    });
  });
});
