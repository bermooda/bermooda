// app/core/catalog/types.server.js
// Digital products and bundle expansion helpers.

import prisma from '#/libs/prisma.server';

export const PRODUCT_TYPES = new Set(['physical', 'digital', 'bundle']);

export async function getDigitalAssets(productId) {
  return prisma.digitalAsset.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getBundleComponents(productId) {
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

export async function upsertDigitalAsset(productId, data) {
  if (data.id) {
    return prisma.digitalAsset.update({
      where: { id: data.id },
      data: {
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? null,
      },
    });
  }

  return prisma.digitalAsset.create({
    data: {
      productId,
      fileName: data.fileName,
      filePath: data.filePath,
      fileSize: data.fileSize ?? null,
      mimeType: data.mimeType ?? null,
    },
  });
}

export async function upsertBundleItem(bundleProductId, componentVariantId, quantity = 1) {
  return prisma.bundleItem.upsert({
    where: {
      bundleProductId_componentVariantId: {
        bundleProductId,
        componentVariantId,
      },
    },
    create: { bundleProductId, componentVariantId, quantity },
    update: { quantity },
  });
}
