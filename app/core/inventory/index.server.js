// app/core/inventory/index.server.js
// Inventory service: atomic decrement/increment and availability.

import prisma from '#/libs/prisma.server';
import { queueEmit } from '#/core/events/job.server';
import {
  decrementLocationLevels,
  getTotalAvailableQuantity,
  incrementLocationLevels,
} from '#/core/inventory/locations/index.server';
import { filterTrackedInventoryItems } from '#/core/inventory/tracking/index.server';

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
    const trackedItems = await filterTrackedInventoryItems(client, items);
    if (trackedItems.length === 0) return;

    const insufficient = [];

    for (const { variantId, quantity } of trackedItems) {
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

    for (const { variantId, quantity } of trackedItems) {
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
    const trackedItems = await filterTrackedInventoryItems(client, items);
    const restocked = [];

    for (const { variantId, quantity } of trackedItems) {
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
    await queueEmit('inventory.restocked', { variantId });
  }
}

// Re-export location helpers for admin routes.
export {
  createLocation,
  ensureDefaultLocation,
  listInventoryLevelsForVariants,
  listLocations,
  listLocationsWithInventory,
  listRecentVariantsForInventory,
  listVariantInventoryLevels,
  setInventoryLevelQuantity,
} from '#/core/inventory/locations/index.server';
