// app/core/inventory/index.server.js
// Inventory service: atomic decrement/increment, availability check, count lookup.

import prisma from '#/libs/prisma.server';

import { emit } from '#/core/events/index.server';
import {
  decrementLocationLevels,
  getTotalAvailableQuantity,
  incrementLocationLevels,
} from '#/core/inventory/locations.server';

// ---------------------------------------------------------------------------
// decrementInventory
// ---------------------------------------------------------------------------

/**
 * Decrement inventory for one or more variants atomically in a transaction.
 * @param {Array<{variantId: string, quantity: number}>} items
 * @param {object} [tx] - Optional Prisma transaction client
 * @throws {Error} 'INSUFFICIENT_INVENTORY' with `.details` array if any item lacks stock
 */
export async function decrementInventory(items, tx) {
  const run = async (client) => {
    const insufficient = [];

    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, inventoryTracked: true },
      });

      if (!variant || !variant.inventoryTracked) continue;

      const available = await getTotalAvailableQuantity(variantId, client);
      if (available < quantity) {
        insufficient.push({ variantId, requested: quantity, available });
      }
    }

    if (insufficient.length > 0) {
      const err = new Error('INSUFFICIENT_INVENTORY');
      err.details = insufficient;
      throw err;
    }

    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { inventoryTracked: true },
      });

      if (!variant || !variant.inventoryTracked) continue;
      await decrementLocationLevels(client, variantId, quantity);
    }
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}

// ---------------------------------------------------------------------------
// incrementInventory
// ---------------------------------------------------------------------------

/**
 * Increment inventory for one or more variants (for refunds/cancellations).
 * @param {Array<{variantId: string, quantity: number}>} items
 * @param {object} [tx] - Optional Prisma transaction client
 */
export async function incrementInventory(items, tx) {
  const run = async (client) => {
    const restocked = [];

    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { inventoryTracked: true },
      });

      if (!variant || !variant.inventoryTracked) continue;

      const { previousTotal, newTotal } = await incrementLocationLevels(
        client,
        variantId,
        quantity
      );

      if (previousTotal <= 0 && newTotal > 0) {
        restocked.push(variantId);
      }
    }

    return restocked;
  };

  const restocked = tx ? await run(tx) : await prisma.$transaction(run);

  for (const variantId of restocked) {
    await emit('inventory.restocked', { variantId });
  }
}

// ---------------------------------------------------------------------------
// checkAvailability
// ---------------------------------------------------------------------------

/**
 * Check availability without modifying inventory.
 * @param {Array<{variantId: string, quantity: number}>} items
 * @returns {{ available: boolean, insufficient?: Array<{variantId, requested, available}> }}
 */
export async function checkAvailability(items) {
  const insufficient = [];

  for (const { variantId, quantity } of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { inventoryTracked: true },
    });

    if (!variant || !variant.inventoryTracked) continue;

    const available = await getTotalAvailableQuantity(variantId);
    if (available < quantity) {
      insufficient.push({ variantId, requested: quantity, available });
    }
  }

  if (insufficient.length > 0) {
    return { available: false, insufficient };
  }

  return { available: true };
}

// ---------------------------------------------------------------------------
// getInventoryCount
// ---------------------------------------------------------------------------

/**
 * Get the current inventory count for a variant.
 * @param {string} variantId
 * @returns {Promise<number>} inventoryCount, or 0 if not found
 */
export async function getInventoryCount(variantId) {
  return getTotalAvailableQuantity(variantId);
}

// Re-export location helpers for admin routes.
export {
  ensureDefaultLocation,
  ensureVariantInventoryLevel,
  syncVariantInventoryCount,
  getTotalAvailableQuantity,
  listLocations,
  listVariantInventoryLevels,
  setInventoryLevelQuantity,
} from '#/core/inventory/locations.server';
