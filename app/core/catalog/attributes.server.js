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

export async function updateProductAttribute(
  attributeId,
  { name, values = [] }
) {
  await prisma.productAttributeValue.deleteMany({ where: { attributeId } });

  return prisma.productAttribute.update({
    where: { id: attributeId },
    data: {
      ...(name !== undefined ? { name } : {}),
      values: {
        create: values.map((value, index) => ({ value, position: index })),
      },
    },
    include: { values: true },
  });
}

export async function deleteProductAttribute(attributeId) {
  return prisma.productAttribute.delete({ where: { id: attributeId } });
}

export async function setVariantOptionValues(variantId, optionValueIds) {
  await prisma.variantOptionValue.deleteMany({ where: { variantId } });
  if (!optionValueIds?.length) return;

  await prisma.variantOptionValue.createMany({
    data: optionValueIds.map((optionValueId) => ({ variantId, optionValueId })),
  });
}

export async function getVariantOptionValues(variantId) {
  return prisma.variantOptionValue.findMany({
    where: { variantId },
    include: { optionValue: { include: { option: true } } },
  });
}
