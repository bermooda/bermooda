// app/core/inventory/locations.server.js
// Location helpers and inventory-level sync for W7 multi-location inventory.

import prisma from '#/libs/prisma.server';

const DEFAULT_LOCATION_CODE = 'default';

/**
 * Ensure a default warehouse location exists.
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 */
export async function ensureDefaultLocation(client = prisma) {
  const existing = await client.location.findFirst({
    where: { isDefault: true },
  });
  if (existing) return existing;

  return client.location.create({
    data: {
      name: 'Default Warehouse',
      code: DEFAULT_LOCATION_CODE,
      isDefault: true,
      active: true,
    },
  });
}

/**
 * Backfill InventoryLevel rows from legacy inventoryCount for a variant.
 * @param {string} variantId
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 */
export async function ensureVariantInventoryLevel(variantId, client = prisma) {
  const location = await ensureDefaultLocation(client);
  const existing = await client.inventoryLevel.findUnique({
    where: {
      variantId_locationId: { variantId, locationId: location.id },
    },
  });
  if (existing) return existing;

  const variant = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { inventoryCount: true },
  });
  if (!variant) return null;

  return client.inventoryLevel.create({
    data: {
      variantId,
      locationId: location.id,
      quantity: variant.inventoryCount,
    },
  });
}

/**
 * Sum location quantities and sync ProductVariant.inventoryCount.
 * @param {string} variantId
 * @param {import('@prisma/client').Prisma.TransactionClient} client
 */
export async function syncVariantInventoryCount(variantId, client) {
  const levels = await client.inventoryLevel.findMany({
    where: { variantId },
    select: { quantity: true },
  });
  const total = levels.reduce((sum, row) => sum + row.quantity, 0);
  await client.productVariant.update({
    where: { id: variantId },
    data: { inventoryCount: total },
  });
  return total;
}

/**
 * Total available quantity across active locations.
 * @param {string} variantId
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 */
export async function getTotalAvailableQuantity(variantId, client = prisma) {
  const levels = await client.inventoryLevel.findMany({
    where: {
      variantId,
      location: { active: true },
    },
    select: { quantity: true },
  });

  if (levels.length > 0) {
    return levels.reduce((sum, row) => sum + row.quantity, 0);
  }

  const variant = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { inventoryCount: true },
  });
  return variant?.inventoryCount ?? 0;
}

/**
 * Decrement stock from location levels (default location first).
 * @param {import('@prisma/client').Prisma.TransactionClient} client
 * @param {string} variantId
 * @param {number} quantity
 */
export async function decrementLocationLevels(client, variantId, quantity) {
  await ensureVariantInventoryLevel(variantId, client);

  const levels = await client.inventoryLevel.findMany({
    where: { variantId, quantity: { gt: 0 } },
    include: { location: true },
    orderBy: { quantity: 'desc' },
  });

  levels.sort((a, b) => {
    if (a.location.isDefault && !b.location.isDefault) return -1;
    if (!a.location.isDefault && b.location.isDefault) return 1;
    return b.quantity - a.quantity;
  });

  let remaining = quantity;
  for (const level of levels) {
    if (remaining <= 0) break;
    if (!level.location.active) continue;

    const take = Math.min(level.quantity, remaining);
    if (take <= 0) continue;

    await client.inventoryLevel.update({
      where: { id: level.id },
      data: { quantity: { decrement: take } },
    });
    remaining -= take;
  }

  if (remaining > 0) {
    const available = quantity - remaining;
    const err = new Error('INSUFFICIENT_INVENTORY');
    err.details = [{ variantId, requested: quantity, available }];
    throw err;
  }

  await syncVariantInventoryCount(variantId, client);
}

/**
 * List all locations with inventory summary.
 */
export async function listLocations() {
  return prisma.location.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { inventoryLevels: true } },
    },
  });
}

/**
 * List locations with nested inventory levels for the admin API.
 */
export async function listLocationsWithInventory() {
  return prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: {
      inventoryLevels: {
        include: {
          variant: { select: { id: true, sku: true, productId: true } },
        },
      },
    },
  });
}

/**
 * Create a warehouse or fulfillment location.
 *
 * @param {{ name: string, code: string, allowsPickup?: boolean }} data
 */
export async function createLocation({ name, code, allowsPickup = false }) {
  return prisma.location.create({
    data: {
      name,
      code,
      active: true,
      allowsPickup,
    },
  });
}

/**
 * Recent variants for the inventory admin screen.
 *
 * @param {{ take?: number }} [options]
 */
export async function listRecentVariantsForInventory({ take = 50 } = {}) {
  return prisma.productVariant.findMany({
    take,
    orderBy: { updatedAt: 'desc' },
    include: {
      product: true,
      prices: true,
    },
  });
}

/**
 * List inventory levels for many variants in one query.
 *
 * @param {string[]} variantIds
 * @returns {Promise<Record<string, import('@prisma/client').InventoryLevel[]>>}
 */
export async function listInventoryLevelsForVariants(variantIds) {
  if (variantIds.length === 0) return {};

  for (const variantId of variantIds) {
    await ensureVariantInventoryLevel(variantId);
  }

  const levels = await prisma.inventoryLevel.findMany({
    where: { variantId: { in: variantIds } },
    include: { location: true },
    orderBy: { location: { isDefault: 'desc' } },
  });

  const levelsByVariant = {};
  for (const level of levels) {
    if (!levelsByVariant[level.variantId]) {
      levelsByVariant[level.variantId] = [];
    }
    levelsByVariant[level.variantId].push(level);
  }

  return levelsByVariant;
}

/**
 * Set quantity for a variant at a location and sync inventoryCount.
 */
export async function setInventoryLevelQuantity(
  variantId,
  locationId,
  quantity
) {
  return prisma.$transaction(async (tx) => {
    const level = await tx.inventoryLevel.upsert({
      where: {
        variantId_locationId: { variantId, locationId },
      },
      create: { variantId, locationId, quantity },
      update: { quantity },
    });
    await syncVariantInventoryCount(variantId, tx);
    return level;
  });
}

/**
 * Set a variant's stock at the default location and sync inventoryCount.
 *
 * @param {string} variantId
 * @param {number} quantity
 */
export async function setDefaultLocationQuantity(variantId, quantity) {
  const location = await ensureDefaultLocation();
  return setInventoryLevelQuantity(variantId, location.id, quantity);
}

/**
 * List inventory levels for a variant across locations.
 */
export async function listVariantInventoryLevels(variantId) {
  await ensureVariantInventoryLevel(variantId);
  return prisma.inventoryLevel.findMany({
    where: { variantId },
    include: { location: true },
    orderBy: { location: { isDefault: 'desc' } },
  });
}

/**
 * Increment stock at the default location.
 * @param {import('@prisma/client').Prisma.TransactionClient} client
 * @param {string} variantId
 * @param {number} quantity
 * @returns {Promise<{ previousTotal: number, newTotal: number }>}
 */
export async function incrementLocationLevels(client, variantId, quantity) {
  const location = await ensureDefaultLocation(client);
  await ensureVariantInventoryLevel(variantId, client);

  const previousTotal = await getTotalAvailableQuantity(variantId, client);

  await client.inventoryLevel.upsert({
    where: {
      variantId_locationId: { variantId, locationId: location.id },
    },
    create: {
      variantId,
      locationId: location.id,
      quantity,
    },
    update: {
      quantity: { increment: quantity },
    },
  });

  const newTotal = await syncVariantInventoryCount(variantId, client);
  return { previousTotal, newTotal };
}
