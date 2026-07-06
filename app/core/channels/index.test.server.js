// app/core/channels/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    salesChannel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    channelProduct: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    product: { findUnique: vi.fn() },
    channelPriceOverride: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  __resetChannelCache,
  applyChannelPricesToProducts,
  buildChannelPublishedWhere,
  isProductPublishedOnChannel,
  resolveChannelFromRequest,
} from '#/core/channels/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  __resetChannelCache();
});

describe('channels', () => {
  it('resolveChannelFromRequest matches domain', async () => {
    const channel = { id: 'ch1', handle: 'eu', active: true };
    prisma.salesChannel.findFirst.mockResolvedValueOnce(channel);

    const result = await resolveChannelFromRequest(
      new Request('https://eu.example.com/products')
    );
    expect(result).toEqual(channel);
    expect(prisma.salesChannel.findFirst).toHaveBeenCalledWith({
      where: { domain: 'eu.example.com', active: true },
    });
  });

  it('isProductPublishedOnChannel respects override', async () => {
    prisma.channelProduct.findUnique.mockResolvedValue({
      published: false,
    });

    const published = await isProductPublishedOnChannel('p1', 'ch1');
    expect(published).toBe(false);
  });

  it('isProductPublishedOnChannel falls back to product publishedAt', async () => {
    prisma.channelProduct.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue({
      publishedAt: new Date(),
    });

    const published = await isProductPublishedOnChannel('p1', 'ch1');
    expect(published).toBe(true);
  });

  it('buildChannelPublishedWhere returns empty object without channelId', () => {
    expect(buildChannelPublishedWhere()).toEqual({});
    expect(buildChannelPublishedWhere('')).toEqual({});
  });

  it('buildChannelPublishedWhere includes override and fallback branches', () => {
    expect(buildChannelPublishedWhere('ch1')).toEqual({
      OR: [
        { channelProducts: { some: { channelId: 'ch1', published: true } } },
        {
          AND: [
            { NOT: { channelProducts: { some: { channelId: 'ch1' } } } },
            { publishedAt: { not: null } },
          ],
        },
      ],
    });
  });

  it('applyChannelPricesToProducts replaces variant prices', async () => {
    prisma.channelPriceOverride.findMany.mockResolvedValue([
      { variantId: 'v1', priceCents: 1999 },
    ]);

    const products = [
      {
        id: 'p1',
        variants: [
          {
            id: 'v1',
            prices: [{ currency: 'USD', priceCents: 2500 }],
          },
        ],
      },
    ];

    const result = await applyChannelPricesToProducts(products, 'ch1', 'USD');
    expect(result[0].variants[0].prices[0].priceCents).toBe(1999);
  });
});
