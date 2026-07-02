// app/core/collections/index.server.js
// Manual and smart product collections.

import prisma from '#/libs/prisma.server';

import {
  getTranslations,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';

export async function listCollections({ publishedOnly = false } = {}) {
  return prisma.collection.findMany({
    where: publishedOnly ? { publishedAt: { not: null } } : undefined,
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { products: true } },
    },
  });
}

export async function getCollectionByHandle(handle, { locale = 'en' } = {}) {
  const collection = await prisma.collection.findUnique({
    where: { handle },
    include: {
      products: {
        orderBy: { position: 'asc' },
        include: {
          product: { include: { variants: { include: { prices: true } } } },
        },
      },
    },
  });
  if (!collection) return null;

  const title = await getTranslations('collection', collection.id, locale);
  return {
    ...collection,
    title: title.title ?? handle,
    description: title.description ?? '',
  };
}

export async function createCollection({
  handle,
  title,
  description,
  collectionType = 'manual',
  rules,
  productIds = [],
}) {
  const collection = await prisma.collection.create({
    data: {
      handle,
      collectionType,
      rulesJson: rules ? JSON.stringify(rules) : null,
      publishedAt: new Date(),
    },
  });

  if (title) {
    await setTranslation('collection', collection.id, 'en', 'title', title);
  }
  if (description) {
    await setTranslation(
      'collection',
      collection.id,
      'en',
      'description',
      description
    );
  }
  await setSlug('collection', collection.id, 'en', handle);

  if (productIds.length) {
    await setCollectionProducts(collection.id, productIds);
  }

  return collection;
}

export async function setCollectionProducts(collectionId, productIds) {
  await prisma.collectionProduct.deleteMany({ where: { collectionId } });
  if (!productIds.length) return;

  await prisma.collectionProduct.createMany({
    data: productIds.map((productId, index) => ({
      collectionId,
      productId,
      position: index,
    })),
  });
}

export async function deleteCollection(id) {
  return prisma.collection.delete({ where: { id } });
}
