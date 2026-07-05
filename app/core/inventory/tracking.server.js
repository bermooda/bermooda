// app/core/inventory/tracking.server.js
// Shared helpers for inventory-tracked variant resolution.

/**
 * Filter inventory items to variants that exist and have inventory tracking enabled.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} client
 * @param {Array<{ variantId: string, quantity: number }>} items
 * @returns {Promise<Array<{ variantId: string, quantity: number }>>}
 */
export async function filterTrackedInventoryItems(client, items) {
  if (items.length === 0) return [];

  const variantIds = [...new Set(items.map((item) => item.variantId))];
  const variants = await client.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, inventoryTracked: true },
  });

  const trackedIds = new Set(
    variants.filter((variant) => variant.inventoryTracked).map((v) => v.id)
  );

  return items.filter((item) => trackedIds.has(item.variantId));
}
