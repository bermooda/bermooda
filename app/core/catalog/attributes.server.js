// app/core/catalog/attributes.server.js
// Product attribute CRUD for faceted search metadata.

import prisma from '#/libs/prisma.server';

export async function listProductAttributes(productId) {
  return prisma.productAttribute.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  });
}

export async function createProductAttribute(productId, { name, values = [] }) {
  const attribute = await prisma.productAttribute.create({
    data: {
      productId,
      name,
      values: {
        create: values.map((value, index) => ({ value, position: index })),
      },
    },
    include: { values: true },
  });
  return attribute;
}

export async function deleteProductAttribute(attributeId) {
  return prisma.productAttribute.delete({ where: { id: attributeId } });
}
