// app/core/pricing/index.server.js
// B2B price lists and customer-group-aware variant pricing.

import prisma from '#/libs/prisma.server';

function isPriceListActive(priceList, now = new Date()) {
  if (!priceList.active) return false;
  if (priceList.startsAt && priceList.startsAt > now) return false;
  if (priceList.expiresAt && priceList.expiresAt <= now) return false;
  return true;
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
  const base = await prisma.variantPrice.findUnique({
    where: { variantId_currency: { variantId, currency } },
  });
  if (!base) return null;

  let bestPrice = base.priceCents;
  let bestSource = 'base';
  let bestPriceListId;
  let bestChannelId;

  if (salesChannelId) {
    const channelOverride = await prisma.channelPriceOverride.findUnique({
      where: {
        channelId_variantId_currency: {
          channelId: salesChannelId,
          variantId,
          currency,
        },
      },
    });
    if (channelOverride) {
      bestPrice = channelOverride.priceCents;
      bestSource = 'channel';
      bestChannelId = salesChannelId;
    }
  }

  const now = new Date();
  const priceLists = await prisma.priceList.findMany({
    where: {
      active: true,
      currency,
      OR: [
        { customerGroupId: null },
        ...(customerGroupIds.length
          ? [{ customerGroupId: { in: customerGroupIds } }]
          : []),
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      entries: {
        where: {
          variantId,
          minQuantity: { lte: quantity },
        },
        orderBy: { minQuantity: 'desc' },
        take: 1,
      },
    },
  });

  for (const priceList of priceLists) {
    if (!isPriceListActive(priceList, now)) continue;
    const entry = priceList.entries[0];
    if (!entry) continue;
    if (entry.priceCents < bestPrice) {
      bestPrice = entry.priceCents;
      bestSource = 'price_list';
      bestPriceListId = priceList.id;
    }
  }

  return {
    priceCents: bestPrice,
    source: bestSource,
    priceListId: bestPriceListId,
    channelId: bestChannelId,
  };
}

/**
 * Re-price cart lines using resolved price lists.
 * @param {object} cart - cart with lines
 * @param {{ customerId?: string, customerGroupIds?: string[] }} options
 */
export async function applyPriceListToCartLines(
  cart,
  { customerId, customerGroupIds } = {}
) {
  if (!cart?.lines?.length) return cart;

  const groupIds =
    customerGroupIds ??
    (customerId ? await getCustomerGroupIds(customerId) : []);

  const lines = await Promise.all(
    cart.lines.map(async (line) => {
      const resolved = await resolveVariantPrice({
        variantId: line.variantId,
        currency: cart.currency,
        quantity: line.quantity,
        customerGroupIds: groupIds,
      });
      if (!resolved) return line;
      return {
        ...line,
        priceCentsSnapshot: resolved.priceCents,
      };
    })
  );

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
