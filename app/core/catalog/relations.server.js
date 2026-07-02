// app/core/catalog/relations.server.js
// Related, cross-sell, and upsell product links.

import prisma from '#/libs/prisma.server';

export const RELATION_TYPES = ['related', 'cross_sell', 'upsell'];

export async function listProductRelations(productId, relationType) {
  return prisma.productRelation.findMany({
    where: {
      productId,
      ...(relationType ? { relationType } : {}),
    },
    orderBy: { position: 'asc' },
    include: {
      related: {
        include: {
          variants: { include: { prices: true }, take: 1 },
        },
      },
    },
  });
}

export async function setProductRelations(
  productId,
  relationType,
  relatedProductIds
) {
  if (!RELATION_TYPES.includes(relationType)) {
    throw new Error('INVALID_RELATION_TYPE');
  }

  await prisma.productRelation.deleteMany({
    where: { productId, relationType },
  });

  if (!relatedProductIds?.length) return;

  await prisma.productRelation.createMany({
    data: relatedProductIds.map((relatedId, index) => ({
      productId,
      relatedId,
      relationType,
      position: index,
    })),
  });
}

export async function assignProductTags(productId, tagNames = []) {
  await prisma.productTagAssignment.deleteMany({ where: { productId } });

  for (const name of tagNames) {
    const trimmed = String(name).trim();
    if (!trimmed) continue;

    const tag = await prisma.productTag.upsert({
      where: { name: trimmed },
      create: { name: trimmed },
      update: {},
    });

    await prisma.productTagAssignment.create({
      data: { productId, tagId: tag.id },
    });
  }
}

export async function listProductTags(productId) {
  const rows = await prisma.productTagAssignment.findMany({
    where: { productId },
    include: { tag: true },
  });
  return rows.map((r) => r.tag.name);
}
