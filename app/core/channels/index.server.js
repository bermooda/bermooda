// app/core/channels/index.server.js
// Multi-store sales channels: domain resolution, catalog visibility, pricing.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

let _defaultChannelId = null;

export async function getDefaultChannel() {
  if (_defaultChannelId) {
    const cached = await prisma.salesChannel.findUnique({
      where: { id: _defaultChannelId },
    });
    if (cached?.active) return cached;
  }

  const channel = await prisma.salesChannel.findFirst({
    where: { isDefault: true, active: true },
  });
  if (channel) {
    _defaultChannelId = channel.id;
    return channel;
  }

  return seedDefaultChannel();
}

export async function seedDefaultChannel() {
  const existing = await prisma.salesChannel.findFirst({
    where: { handle: 'default' },
  });
  if (existing) {
    _defaultChannelId = existing.id;
    return existing;
  }

  const channel = await prisma.salesChannel.create({
    data: {
      name: 'Default Store',
      handle: 'default',
      isDefault: true,
      currency: 'USD',
      locale: 'en',
      active: true,
    },
  });
  _defaultChannelId = channel.id;
  logger.info({ channelId: channel.id }, 'Default sales channel seeded');
  return channel;
}

/**
 * Resolve sales channel from request Host header.
 * @param {Request} request
 */
export async function resolveChannelFromRequest(request) {
  const host = new URL(request.url).host.toLowerCase();
  if (!host) return getDefaultChannel();

  const byDomain = await prisma.salesChannel.findFirst({
    where: { domain: host, active: true },
  });
  if (byDomain) return byDomain;

  return getDefaultChannel();
}

export async function listChannels({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const [channels, total] = await Promise.all([
    prisma.salesChannel.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.salesChannel.count(),
  ]);
  return { channels, total };
}

export async function getChannelById(id) {
  return prisma.salesChannel.findUnique({ where: { id } });
}

export async function createChannel(data) {
  if (data.isDefault) {
    await prisma.salesChannel.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const channel = await prisma.salesChannel.create({
    data: {
      name: data.name,
      handle: data.handle,
      domain: data.domain ?? null,
      isDefault: data.isDefault ?? false,
      currency: data.currency ?? 'USD',
      locale: data.locale ?? 'en',
      active: data.active ?? true,
    },
  });

  if (channel.isDefault) _defaultChannelId = channel.id;
  return channel;
}

export async function updateChannel(id, data) {
  if (data.isDefault) {
    await prisma.salesChannel.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const channel = await prisma.salesChannel.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.handle !== undefined ? { handle: data.handle } : {}),
      ...(data.domain !== undefined ? { domain: data.domain || null } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.locale !== undefined ? { locale: data.locale } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  if (channel.isDefault) _defaultChannelId = channel.id;
  return channel;
}

export async function setChannelProductPublished(
  channelId,
  productId,
  published
) {
  return prisma.channelProduct.upsert({
    where: {
      channelId_productId: { channelId, productId },
    },
    create: { channelId, productId, published },
    update: { published },
  });
}

export async function isProductPublishedOnChannel(productId, channelId) {
  const override = await prisma.channelProduct.findUnique({
    where: {
      channelId_productId: { channelId, productId },
    },
  });
  if (override) return override.published;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { publishedAt: true },
  });
  return product?.publishedAt != null;
}

export async function getChannelPriceOverride(channelId, variantId, currency) {
  return prisma.channelPriceOverride.findUnique({
    where: {
      channelId_variantId_currency: { channelId, variantId, currency },
    },
  });
}

export async function setChannelPriceOverride(
  channelId,
  variantId,
  currency,
  priceCents
) {
  return prisma.channelPriceOverride.upsert({
    where: {
      channelId_variantId_currency: { channelId, variantId, currency },
    },
    create: { channelId, variantId, currency, priceCents },
    update: { priceCents },
  });
}

export async function listChannelProducts(channelId) {
  return prisma.channelProduct.findMany({
    where: { channelId },
    include: { product: { include: { variants: true } } },
  });
}

/**
 * Prisma `where` fragment: products visible on a sales channel.
 * Honors ChannelProduct overrides; falls back to product.publishedAt.
 *
 * @param {string} channelId
 */
export function buildChannelPublishedWhere(channelId) {
  if (!channelId) return {};
  return {
    OR: [
      { channelProducts: { some: { channelId, published: true } } },
      {
        AND: [
          { NOT: { channelProducts: { some: { channelId } } } },
          { publishedAt: { not: null } },
        ],
      },
    ],
  };
}

/**
 * Apply channel price overrides to hydrated catalog/search products.
 *
 * @param {Array} products
 * @param {string|undefined} channelId
 * @param {string|undefined} currency
 */
export async function applyChannelPricesToProducts(
  products,
  channelId,
  currency
) {
  if (!channelId || !currency || !products?.length) return products;

  const variantIds = products.flatMap(
    (product) => product.variants?.map((variant) => variant.id) ?? []
  );
  if (!variantIds.length) return products;

  const overrides = await prisma.channelPriceOverride.findMany({
    where: { channelId, variantId: { in: variantIds }, currency },
  });
  if (!overrides.length) return products;

  const overrideMap = Object.fromEntries(
    overrides.map((row) => [row.variantId, row.priceCents])
  );

  return products.map((product) => ({
    ...product,
    variants: product.variants?.map((variant) => {
      const priceCents = overrideMap[variant.id];
      if (priceCents == null) return variant;

      const prices = variant.prices?.length
        ? variant.prices.map((price) =>
            price.currency === currency ? { ...price, priceCents } : price
          )
        : [{ currency, priceCents }];

      return { ...variant, prices };
    }),
  }));
}

/** Reset cached default channel id. Test use only. */
export function __resetChannelCache() {
  _defaultChannelId = null;
}
