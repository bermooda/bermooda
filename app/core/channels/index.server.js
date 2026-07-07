// app/core/channels/index.server.js
// Multi-store sales channels: domain resolution, catalog visibility, pricing.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { getAvailableLocales } from '#/core/i18n/index.server';
import { getEnabledCurrencies } from '#/core/settings/index.server';

export const DEFAULT_CHANNEL_LIST_LIMIT = 20;
export const MAX_CHANNEL_LIST_RESULTS = 100;
export const CHANNEL_HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CHANNEL_PRICE_OVERRIDE_PRODUCT_LIMIT = 50;

let _defaultChannelId = null;

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse channel list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseChannelListParams(source = {}) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    Math.max(
      1,
      parseInt(get('limit') ?? String(DEFAULT_CHANNEL_LIST_LIMIT), 10) ||
        DEFAULT_CHANNEL_LIST_LIMIT
    ),
    MAX_CHANNEL_LIST_RESULTS
  );

  return { page, limit };
}

/**
 * Normalize a sales channel handle.
 *
 * @param {string} handle
 */
export function normalizeChannelHandle(handle) {
  return handle?.toString().trim().toLowerCase() ?? '';
}

/**
 * Validate a sales channel handle.
 *
 * @param {string} handle
 */
export function validateChannelHandle(handle) {
  const normalized = normalizeChannelHandle(handle);
  if (!normalized) {
    throw Object.assign(new Error('Handle is required.'), {
      code: 'HANDLE_REQUIRED',
    });
  }
  if (!CHANNEL_HANDLE_PATTERN.test(normalized)) {
    throw Object.assign(
      new Error('Handle must be lowercase letters, numbers and hyphens only.'),
      { code: 'HANDLE_INVALID' }
    );
  }
  return normalized;
}

/**
 * Parse admin/API create payload into normalized channel fields.
 *
 * @param {object} input
 */
export async function parseCreateChannelInput(input = {}) {
  const name = input.name?.toString().trim();
  const handle = validateChannelHandle(input.handle);
  const domain = input.domain?.toString().trim() || null;
  const currency = input.currency?.toString().trim().toUpperCase() || 'USD';
  const locale = input.locale?.toString().trim() || 'en';
  const active =
    input.active === undefined
      ? true
      : input.active === true ||
        input.active === 'on' ||
        input.active === 'true';
  const isDefault =
    input.isDefault === true ||
    input.isDefault === 'on' ||
    input.isDefault === 'true';

  if (!name) {
    throw Object.assign(new Error('Name is required.'), {
      code: 'NAME_REQUIRED',
    });
  }

  const [enabledCurrencies, availableLocales] = await Promise.all([
    getEnabledCurrencies(),
    getAvailableLocales(),
  ]);

  if (!enabledCurrencies.includes(currency)) {
    throw Object.assign(new Error('Currency is not enabled for this shop.'), {
      code: 'CURRENCY_INVALID',
    });
  }

  if (!availableLocales.includes(locale)) {
    throw Object.assign(new Error('Locale is not enabled for this shop.'), {
      code: 'LOCALE_INVALID',
    });
  }

  return { name, handle, domain, currency, locale, active, isDefault };
}

/**
 * Parse admin/API update payload into normalized channel fields.
 *
 * @param {object} input
 */
export async function parseUpdateChannelInput(input = {}) {
  const parsed = {};

  if ('name' in input) {
    const name = input.name?.toString().trim();
    if (!name) {
      throw Object.assign(new Error('Name is required.'), {
        code: 'NAME_REQUIRED',
      });
    }
    parsed.name = name;
  }

  if ('handle' in input) {
    parsed.handle = validateChannelHandle(input.handle);
  }

  if ('domain' in input) {
    parsed.domain = input.domain?.toString().trim() || null;
  }

  if ('currency' in input) {
    const currency = input.currency?.toString().trim().toUpperCase();
    const enabledCurrencies = await getEnabledCurrencies();
    if (!currency || !enabledCurrencies.includes(currency)) {
      throw Object.assign(new Error('Currency is not enabled for this shop.'), {
        code: 'CURRENCY_INVALID',
      });
    }
    parsed.currency = currency;
  }

  if ('locale' in input) {
    const locale = input.locale?.toString().trim();
    const availableLocales = await getAvailableLocales();
    if (!locale || !availableLocales.includes(locale)) {
      throw Object.assign(new Error('Locale is not enabled for this shop.'), {
        code: 'LOCALE_INVALID',
      });
    }
    parsed.locale = locale;
  }

  if ('active' in input) {
    parsed.active =
      input.active === true || input.active === 'on' || input.active === 'true';
  }

  if ('isDefault' in input) {
    parsed.isDefault =
      input.isDefault === true ||
      input.isDefault === 'on' ||
      input.isDefault === 'true';
  }

  return parsed;
}

/**
 * Parse channel price override payload from admin/API input.
 *
 * @param {object} input
 */
export async function parseSetChannelPriceOverrideInput(input = {}) {
  const channelId = input.channelId?.toString().trim();
  const variantId = input.variantId?.toString().trim();
  const currency = input.currency?.toString().trim().toUpperCase() || 'USD';
  const priceCents =
    typeof input.priceCents === 'number'
      ? input.priceCents
      : parseInt(String(input.priceCents ?? '0'), 10);

  if (!channelId) {
    throw Object.assign(new Error('Channel is required.'), {
      code: 'CHANNEL_REQUIRED',
    });
  }
  if (!variantId) {
    throw Object.assign(new Error('Variant is required.'), {
      code: 'VARIANT_REQUIRED',
    });
  }
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw Object.assign(
      new Error('Price must be a positive integer in cents.'),
      {
        code: 'PRICE_INVALID',
      }
    );
  }

  const enabledCurrencies = await getEnabledCurrencies();
  if (!enabledCurrencies.includes(currency)) {
    throw Object.assign(new Error('Currency is not enabled for this shop.'), {
      code: 'CURRENCY_INVALID',
    });
  }

  return { channelId, variantId, currency, priceCents };
}

/**
 * Parse admin form action payloads for the channels index page.
 *
 * @param {FormData} formData
 */
export async function parseChannelAdminAction(formData) {
  const intent = formData.get('intent')?.toString();

  if (intent === 'set-default') {
    const channelId = formData.get('channelId')?.toString().trim();
    if (!channelId) {
      throw Object.assign(new Error('Channel is required.'), {
        code: 'CHANNEL_REQUIRED',
      });
    }
    return { intent, channelId };
  }

  if (intent === 'set-price') {
    const parsed = await parseSetChannelPriceOverrideInput({
      channelId: formData.get('channelId')?.toString(),
      variantId: formData.get('variantId')?.toString(),
      currency: formData.get('currency')?.toString(),
      priceCents: formData.get('priceCents')?.toString(),
    });
    return { intent, ...parsed };
  }

  throw Object.assign(new Error('Unknown action.'), { code: 'ACTION_INVALID' });
}

/**
 * Serialize a sales channel for admin/API responses.
 *
 * @param {object|null|undefined} channel
 */
export function serializeChannel(channel) {
  if (!channel) return null;

  return {
    id: channel.id,
    name: channel.name,
    handle: channel.handle,
    domain: channel.domain,
    isDefault: channel.isDefault,
    currency: channel.currency,
    locale: channel.locale,
    active: channel.active,
    createdAt: channel.createdAt?.toISOString?.() ?? channel.createdAt,
    updatedAt: channel.updatedAt?.toISOString?.() ?? channel.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Channel resolution
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Channel CRUD
// ---------------------------------------------------------------------------

export async function listChannels(params = {}) {
  const { page, limit } = parseChannelListParams(params);
  const skip = (page - 1) * limit;
  const [channels, total] = await Promise.all([
    prisma.salesChannel.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.salesChannel.count(),
  ]);
  return { channels, total, page, limit };
}

export async function getChannel(id) {
  const channel = await prisma.salesChannel.findUnique({ where: { id } });
  if (!channel) {
    throw Object.assign(new Error('Channel not found.'), {
      code: 'CHANNEL_NOT_FOUND',
    });
  }
  return channel;
}

export async function createChannel(input) {
  const data = await parseCreateChannelInput(input);

  if (data.isDefault) {
    await prisma.salesChannel.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  try {
    const channel = await prisma.salesChannel.create({
      data: {
        name: data.name,
        handle: data.handle,
        domain: data.domain,
        isDefault: data.isDefault,
        currency: data.currency,
        locale: data.locale,
        active: data.active,
      },
    });

    if (channel.isDefault) _defaultChannelId = channel.id;
    return channel;
  } catch (err) {
    if (err.code === 'P2002') {
      throw Object.assign(new Error('Handle or domain already in use.'), {
        code: 'CHANNEL_CONFLICT',
      });
    }
    throw err;
  }
}

export async function updateChannel(id, input) {
  await getChannel(id);
  const data = await parseUpdateChannelInput(input);

  if (data.isDefault) {
    await prisma.salesChannel.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  try {
    const channel = await prisma.salesChannel.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.handle !== undefined ? { handle: data.handle } : {}),
        ...(data.domain !== undefined ? { domain: data.domain } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    if (channel.isDefault) _defaultChannelId = channel.id;
    return channel;
  } catch (err) {
    if (err.code === 'P2002') {
      throw Object.assign(new Error('Handle or domain already in use.'), {
        code: 'CHANNEL_CONFLICT',
      });
    }
    throw err;
  }
}

/**
 * Load data for the admin channels index page.
 *
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function loadChannelAdminIndexData(params = {}) {
  const [{ channels, total, page, limit }, products] = await Promise.all([
    listChannels({ ...params, limit: params.limit ?? 100 }),
    listProductsForChannelPriceOverrides(),
  ]);

  return { channels, total, page, limit, products };
}

/**
 * Products for the channel price override form in admin.
 */
export async function listProductsForChannelPriceOverrides({
  limit = CHANNEL_PRICE_OVERRIDE_PRODUCT_LIMIT,
} = {}) {
  return prisma.product.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { variants: { include: { prices: true } } },
  });
}

// ---------------------------------------------------------------------------
// Channel catalog overrides
// ---------------------------------------------------------------------------

export async function setChannelProductPublished(
  channelId,
  productId,
  published
) {
  await getChannel(channelId);
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

export async function setChannelPriceOverride(input) {
  const { channelId, variantId, currency, priceCents } =
    await parseSetChannelPriceOverrideInput(input);

  await getChannel(channelId);

  return prisma.channelPriceOverride.upsert({
    where: {
      channelId_variantId_currency: { channelId, variantId, currency },
    },
    create: { channelId, variantId, currency, priceCents },
    update: { priceCents },
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
