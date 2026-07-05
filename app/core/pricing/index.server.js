// app/core/pricing/index.server.js
// B2B price lists and customer-group-aware variant pricing.

import prisma from '#/libs/prisma.server';

import { getChannelPriceOverride } from '#/core/channels/index.server';

/**
 * Whether a price list is active for the given timestamp.
 *
 * @param {object} priceList
 * @param {Date} [now]
 */
export function isPriceListActive(priceList, now = new Date()) {
  if (!priceList.active) return false;
  if (priceList.startsAt && priceList.startsAt > now) return false;
  if (priceList.expiresAt && priceList.expiresAt <= now) return false;
  return true;
}

/**
 * Prisma `OR` filter for price lists scoped to customer groups.
 *
 * @param {string[]} customerGroupIds
 */
export function buildPriceListGroupWhere(customerGroupIds) {
  return [
    { customerGroupId: null },
    ...(customerGroupIds.length
      ? [{ customerGroupId: { in: customerGroupIds } }]
      : []),
  ];
}

/**
 * Pick the lowest applicable price from base, channel, and price list sources.
 *
 * @param {{
 *   basePriceCents?: number|null,
 *   channelPriceCents?: number|null,
 *   channelId?: string,
 *   priceLists?: object[],
 *   variantId: string,
 *   quantity?: number,
 *   now?: Date,
 * }} params
 * @returns {{ priceCents: number, source: 'base'|'price_list'|'channel', priceListId?: string, channelId?: string }|null}
 */
export function pickBestVariantPrice({
  basePriceCents = null,
  channelPriceCents = null,
  channelId,
  priceLists = [],
  variantId,
  quantity = 1,
  now = new Date(),
}) {
  let bestPrice = basePriceCents ?? null;
  let bestSource = basePriceCents != null ? 'base' : null;
  let bestPriceListId;
  let bestChannelId;

  if (channelPriceCents != null) {
    if (bestPrice == null || channelPriceCents < bestPrice) {
      bestPrice = channelPriceCents;
      bestSource = 'channel';
      bestChannelId = channelId;
      bestPriceListId = undefined;
    }
  }

  for (const priceList of priceLists) {
    if (!isPriceListActive(priceList, now)) continue;

    const entry = priceList.entries
      ?.filter(
        (row) => row.variantId === variantId && row.minQuantity <= quantity
      )
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    if (!entry) continue;

    if (bestPrice == null || entry.priceCents < bestPrice) {
      bestPrice = entry.priceCents;
      bestSource = 'price_list';
      bestPriceListId = priceList.id;
      bestChannelId = undefined;
    }
  }

  if (bestPrice == null || bestSource == null) return null;

  return {
    priceCents: bestPrice,
    source: bestSource,
    priceListId: bestPriceListId,
    channelId: bestChannelId,
  };
}

/**
 * List customer group IDs for a customer.
 * @param {string} customerId
 */
export async function getCustomerGroupIds(customerId) {
  if (!customerId) return [];
  const rows = await prisma.customerGroupMember.findMany({
    where: { customerId },
    select: { customerGroupId: true },
  });
  return rows.map((row) => row.customerGroupId);
}

/**
 * Resolve customer group IDs from explicit ids or a customer record.
 *
 * @param {{
 *   customerId?: string,
 *   customerGroupId?: string,
 *   customerGroupIds?: string[],
 * }} params
 */
export async function resolveCustomerGroupIds({
  customerId,
  customerGroupId,
  customerGroupIds,
} = {}) {
  if (customerGroupIds?.length) return customerGroupIds;
  if (customerGroupId) return [customerGroupId];
  if (customerId) return getCustomerGroupIds(customerId);
  return [];
}

async function loadActivePriceLists({
  currency,
  customerGroupIds,
  variantIds,
}) {
  return prisma.priceList.findMany({
    where: {
      active: true,
      currency,
      OR: buildPriceListGroupWhere(customerGroupIds),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      entries: {
        where: {
          variantId: { in: variantIds },
        },
        orderBy: { minQuantity: 'desc' },
      },
    },
  });
}

/**
 * Resolve the best unit price for a variant in a currency.
 * Honors active price lists for the customer's groups and quantity breaks.
 *
 * @param {{
 *   variantId: string,
 *   currency: string,
 *   quantity?: number,
 *   customerGroupIds?: string[],
 *   salesChannelId?: string,
 * }} params
 * @returns {Promise<{ priceCents: number, source: 'base'|'price_list'|'channel', priceListId?: string, channelId?: string }|null>}
 */
export async function resolveVariantPrice({
  variantId,
  currency,
  quantity = 1,
  customerGroupIds = [],
  salesChannelId,
}) {
  const [base, channelOverride, priceLists] = await Promise.all([
    prisma.variantPrice.findUnique({
      where: { variantId_currency: { variantId, currency } },
    }),
    salesChannelId
      ? getChannelPriceOverride(salesChannelId, variantId, currency)
      : null,
    loadActivePriceLists({
      currency,
      customerGroupIds,
      variantIds: [variantId],
    }),
  ]);

  return pickBestVariantPrice({
    basePriceCents: base?.priceCents ?? null,
    channelPriceCents: channelOverride?.priceCents ?? null,
    channelId: salesChannelId,
    priceLists,
    variantId,
    quantity,
  });
}

/**
 * Resolve prices for multiple variant/quantity pairs with batched queries.
 *
 * @param {Array<{ variantId: string, quantity?: number }>} items
 * @param {{
 *   currency: string,
 *   customerGroupIds?: string[],
 *   salesChannelId?: string,
 * }} options
 * @returns {Promise<Map<string, { priceCents: number, source: 'base'|'price_list'|'channel', priceListId?: string, channelId?: string }>>}
 */
export async function resolveVariantPrices(
  items,
  { currency, customerGroupIds = [], salesChannelId } = {}
) {
  const results = new Map();
  if (!items?.length) return results;

  const variantIds = [...new Set(items.map((item) => item.variantId))];

  const [basePrices, channelOverrides, priceLists] = await Promise.all([
    prisma.variantPrice.findMany({
      where: { variantId: { in: variantIds }, currency },
    }),
    salesChannelId
      ? prisma.channelPriceOverride.findMany({
          where: {
            channelId: salesChannelId,
            variantId: { in: variantIds },
            currency,
          },
        })
      : [],
    loadActivePriceLists({ currency, customerGroupIds, variantIds }),
  ]);

  const baseByVariant = Object.fromEntries(
    basePrices.map((row) => [row.variantId, row.priceCents])
  );
  const channelByVariant = Object.fromEntries(
    channelOverrides.map((row) => [row.variantId, row.priceCents])
  );

  for (const item of items) {
    const resolved = pickBestVariantPrice({
      basePriceCents: baseByVariant[item.variantId] ?? null,
      channelPriceCents: channelByVariant[item.variantId] ?? null,
      channelId: salesChannelId,
      priceLists,
      variantId: item.variantId,
      quantity: item.quantity ?? 1,
    });
    if (resolved) {
      results.set(`${item.variantId}:${item.quantity ?? 1}`, resolved);
    }
  }

  return results;
}

/**
 * Re-price cart lines using resolved price lists.
 * @param {object} cart - cart with lines
 * @param {{ customerId?: string, customerGroupIds?: string[], salesChannelId?: string }} options
 */
export async function applyPriceListToCartLines(
  cart,
  { customerId, customerGroupIds, salesChannelId } = {}
) {
  if (!cart?.lines?.length) return cart;

  const groupIds = await resolveCustomerGroupIds({
    customerId,
    customerGroupIds,
  });
  const priceByLineKey = await resolveVariantPrices(cart.lines, {
    currency: cart.currency,
    customerGroupIds: groupIds,
    salesChannelId,
  });

  const lines = cart.lines.map((line) => {
    const resolved = priceByLineKey.get(`${line.variantId}:${line.quantity}`);
    if (!resolved) return line;
    return {
      ...line,
      priceCentsSnapshot: resolved.priceCents,
    };
  });

  return { ...cart, lines };
}

// ---------------------------------------------------------------------------
// Customer groups CRUD
// ---------------------------------------------------------------------------

export async function listCustomerGroups() {
  return prisma.customerGroup.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true, priceLists: true } } },
  });
}

export async function listCustomerGroupMembers() {
  return prisma.customerGroupMember.findMany({
    include: {
      customer: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  });
}

export async function createCustomerGroup({ name, handle }) {
  return prisma.customerGroup.create({
    data: { name, handle },
  });
}

export async function addCustomerToGroup(customerGroupId, customerId) {
  return prisma.customerGroupMember.upsert({
    where: {
      customerGroupId_customerId: { customerGroupId, customerId },
    },
    create: { customerGroupId, customerId },
    update: {},
  });
}

export async function removeCustomerFromGroup(customerGroupId, customerId) {
  return prisma.customerGroupMember.delete({
    where: {
      customerGroupId_customerId: { customerGroupId, customerId },
    },
  });
}

// ---------------------------------------------------------------------------
// Price list CRUD
// ---------------------------------------------------------------------------

export async function listPriceLists() {
  return prisma.priceList.findMany({
    orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    include: {
      customerGroup: true,
      _count: { select: { entries: true } },
    },
  });
}

export async function createPriceList(data) {
  return prisma.priceList.create({ data });
}

export async function upsertPriceListEntry({
  priceListId,
  variantId,
  priceCents,
  minQuantity = 1,
}) {
  return prisma.priceListEntry.upsert({
    where: {
      priceListId_variantId_minQuantity: {
        priceListId,
        variantId,
        minQuantity,
      },
    },
    create: { priceListId, variantId, priceCents, minQuantity },
    update: { priceCents },
  });
}
