// app/core/catalog/types/index.server.js
// Bundle expansion helpers for inventory.

import prisma from '#/libs/prisma.server';

async function getBundleComponents(productId) {
  return prisma.bundleItem.findMany({
    where: { bundleProductId: productId },
    include: { componentVariant: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Expand bundle lines into component variant quantities for inventory.
 * @param {Array<{ variantId: string, quantity: number }>} items
 * @returns {Promise<Array<{ variantId: string, quantity: number }>>}
 */
export async function expandBundleInventoryItems(items) {
  const expanded = [];

  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: { select: { productType: true } } },
    });
    if (!variant) continue;

    if (variant.product.productType !== 'bundle') {
      expanded.push(item);
      continue;
    }

    const components = await getBundleComponents(variant.productId);
    for (const component of components) {
      expanded.push({
        variantId: component.componentVariantId,
        quantity: item.quantity * component.quantity,
      });
    }
  }

  return expanded;
}
