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
    channelProduct: { findUnique: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn() },
    channelPriceOverride: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  __resetChannelCache,
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
});
