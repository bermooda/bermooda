// app/core/channels/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    salesChannel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    channelProduct: { findUnique: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn(), findMany: vi.fn() },
    channelPriceOverride: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('#/core/settings/index.server', () => ({
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD', 'EUR']),
}));

vi.mock('#/core/i18n/index.server', () => ({
  getAvailableLocales: vi.fn().mockResolvedValue(['en', 'de']),
}));

import prisma from '#/libs/prisma.server';
import {
  __resetChannelCache,
  applyChannelPricesToProducts,
  buildChannelPublishedWhere,
  createChannel,
  getChannel,
  isProductPublishedOnChannel,
  listChannels,
  normalizeChannelHandle,
  parseChannelListParams,
  parseCreateChannelInput,
  parseSetChannelPriceOverrideInput,
  resolveChannelFromRequest,
  serializeChannel,
  setChannelPriceOverride,
  validateChannelHandle,
} from '#/core/channels/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  __resetChannelCache();
});

describe('channels', () => {
  it('parseChannelListParams clamps page and limit', () => {
    expect(parseChannelListParams({ page: '0', limit: '999' })).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it('validateChannelHandle rejects invalid handles', () => {
    expect(() => validateChannelHandle('EU Store')).toThrow(/lowercase/);
    expect(validateChannelHandle('eu-store')).toBe('eu-store');
  });

  it('normalizeChannelHandle lowercases and trims', () => {
    expect(normalizeChannelHandle(' EU-Store ')).toBe('eu-store');
  });

  it('parseCreateChannelInput validates enabled currency and locale', async () => {
    await expect(
      parseCreateChannelInput({
        name: 'EU Store',
        handle: 'eu',
        currency: 'GBP',
        locale: 'en',
      })
    ).rejects.toMatchObject({ code: 'CURRENCY_INVALID' });

    await expect(
      parseCreateChannelInput({
        name: 'EU Store',
        handle: 'eu',
        currency: 'USD',
        locale: 'ja',
      })
    ).rejects.toMatchObject({ code: 'LOCALE_INVALID' });
  });

  it('serializeChannel formats timestamps', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(
      serializeChannel({
        id: 'ch1',
        name: 'Default',
        handle: 'default',
        domain: null,
        isDefault: true,
        currency: 'USD',
        locale: 'en',
        active: true,
        createdAt,
        updatedAt: createdAt,
      })
    ).toEqual({
      id: 'ch1',
      name: 'Default',
      handle: 'default',
      domain: null,
      isDefault: true,
      currency: 'USD',
      locale: 'en',
      active: true,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  });

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

  it('getChannel throws when missing', async () => {
    prisma.salesChannel.findUnique.mockResolvedValue(null);
    await expect(getChannel('missing')).rejects.toMatchObject({
      code: 'CHANNEL_NOT_FOUND',
    });
  });

  it('listChannels returns paginated payload', async () => {
    prisma.salesChannel.findMany.mockResolvedValue([{ id: 'ch1' }]);
    prisma.salesChannel.count.mockResolvedValue(1);

    await expect(listChannels({ page: 2, limit: 10 })).resolves.toEqual({
      channels: [{ id: 'ch1' }],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('createChannel clears other defaults when creating default channel', async () => {
    prisma.salesChannel.updateMany.mockResolvedValue({ count: 1 });
    prisma.salesChannel.create.mockResolvedValue({
      id: 'ch2',
      handle: 'eu',
      isDefault: true,
    });

    await createChannel({
      name: 'EU Store',
      handle: 'eu',
      currency: 'EUR',
      locale: 'de',
      isDefault: true,
    });

    expect(prisma.salesChannel.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
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

  it('setChannelPriceOverride validates channel exists', async () => {
    prisma.salesChannel.findUnique.mockResolvedValue(null);

    await expect(
      setChannelPriceOverride({
        channelId: 'missing',
        variantId: 'v1',
        currency: 'USD',
        priceCents: 1000,
      })
    ).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' });
  });

  it('parseSetChannelPriceOverrideInput rejects invalid price', async () => {
    await expect(
      parseSetChannelPriceOverrideInput({
        channelId: 'ch1',
        variantId: 'v1',
        priceCents: 0,
      })
    ).rejects.toMatchObject({ code: 'PRICE_INVALID' });
  });
});
