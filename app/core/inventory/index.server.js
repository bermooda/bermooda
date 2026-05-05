// app/core/inventory/index.server.js
// Inventory service: atomic decrement/increment, availability check, count lookup.

import prisma from '#/libs/prisma.server';

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

    // Fetch all variants and check availability within the transaction.
    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, inventoryCount: true, inventoryTracked: true },
      });

      // Skip untracked variants.
      if (!variant || !variant.inventoryTracked) continue;

      if (variant.inventoryCount < quantity) {
        insufficient.push({
          variantId,
          requested: quantity,
          available: variant.inventoryCount,
        });
      }
    }

    if (insufficient.length > 0) {
      const err = new Error('INSUFFICIENT_INVENTORY');
      err.details = insufficient;
      throw err;
    }

    // All items are available — decrement each tracked variant.
    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { inventoryTracked: true },
      });

      if (!variant || !variant.inventoryTracked) continue;

      await client.productVariant.update({
        where: { id: variantId },
        data: { inventoryCount: { decrement: quantity } },
      });
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
    for (const { variantId, quantity } of items) {
      const variant = await client.productVariant.findUnique({
        where: { id: variantId },
        select: { inventoryTracked: true },
      });

      if (!variant || !variant.inventoryTracked) continue;

      await client.productVariant.update({
        where: { id: variantId },
        data: { inventoryCount: { increment: quantity } },
      });
    }
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
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
      select: { inventoryCount: true, inventoryTracked: true },
    });

    // Untracked variants are always available.
    if (!variant || !variant.inventoryTracked) continue;

    if (variant.inventoryCount < quantity) {
      insufficient.push({
        variantId,
        requested: quantity,
        available: variant.inventoryCount,
      });
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
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { inventoryCount: true },
  });

  return variant?.inventoryCount ?? 0;
}
