// app/core/collections/index.server.js
// Manual and smart product collections.

import prisma from '#/libs/prisma.server';

import {
  getTranslations,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import {
  parseCollectionRules,
  productMatchesCollectionRules,
} from '#/core/collections/rules.server';

export { parseCollectionRules, productMatchesCollectionRules };

export async function listCollections({ publishedOnly = false } = {}) {
  return prisma.collection.findMany({
    where: publishedOnly ? { publishedAt: { not: null } } : undefined,
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { products: true } },
    },
  });
}

export async function getCollection(id, { locale = 'en' } = {}) {
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { position: 'asc' },
        select: { productId: true, position: true },
      },
    },
  });
  if (!collection) return null;

  const translations = await getTranslations(
    'collection',
    collection.id,
    locale
  );
  return {
    ...collection,
    title: translations.title ?? collection.handle,
    description: translations.description ?? '',
    rules: collection.rulesJson
      ? parseCollectionRules(collection.rulesJson)
      : null,
    productIds: collection.products.map((row) => row.productId),
  };
}

export async function getCollectionByHandle(
  handle,
  { locale = 'en', publishedOnly = false } = {}
) {
  const collection = await prisma.collection.findUnique({
    where: { handle },
    include: {
      products: {
        orderBy: { position: 'asc' },
        select: { productId: true },
      },
    },
  });
  if (!collection) return null;
  if (publishedOnly && !collection.publishedAt) return null;

  const translations = await getTranslations(
    'collection',
    collection.id,
    locale
  );
  return {
    ...collection,
    title: translations.title ?? handle,
    description: translations.description ?? '',
    productIds: collection.products.map((row) => row.productId),
  };
}

export async function getCollectionProductIds(collectionId) {
  const rows = await prisma.collectionProduct.findMany({
    where: { collectionId },
    orderBy: { position: 'asc' },
    select: { productId: true },
  });
  return rows.map((row) => row.productId);
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

  if (collectionType === 'smart') {
    await refreshSmartCollection(collection.id);
  } else if (productIds.length) {
    await setCollectionProducts(collection.id, productIds);
  }

  return collection;
}

export async function updateCollection(
  id,
  {
    handle,
    title,
    description,
    collectionType,
    rules,
    productIds,
    published,
  } = {}
) {
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) throw new Error('COLLECTION_NOT_FOUND');

  const nextType = collectionType ?? existing.collectionType;
  const nextRules =
    rules !== undefined
      ? rules
      : existing.rulesJson
        ? parseCollectionRules(existing.rulesJson)
        : null;

  const collection = await prisma.collection.update({
    where: { id },
    data: {
      ...(handle !== undefined ? { handle } : {}),
      ...(collectionType !== undefined ? { collectionType: nextType } : {}),
      ...(rules !== undefined || collectionType !== undefined
        ? { rulesJson: nextType === 'smart' ? JSON.stringify(nextRules) : null }
        : {}),
      ...(published === true ? { publishedAt: new Date() } : {}),
      ...(published === false ? { publishedAt: null } : {}),
    },
  });

  if (title !== undefined) {
    await setTranslation('collection', id, 'en', 'title', title);
  }
  if (description !== undefined) {
    await setTranslation('collection', id, 'en', 'description', description);
  }
  if (handle !== undefined) {
    await setSlug('collection', id, 'en', handle);
  }

  if (nextType === 'smart') {
    await refreshSmartCollection(id);
  } else if (productIds !== undefined) {
    await setCollectionProducts(id, productIds);
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

/**
 * Re-evaluate a smart collection and sync CollectionProduct rows.
 */
export async function refreshSmartCollection(collectionId) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
  });
  if (!collection || collection.collectionType !== 'smart') return { count: 0 };

  const rules = parseCollectionRules(collection.rulesJson);
  const products = await prisma.product.findMany({
    where: { publishedAt: { not: null } },
    include: {
      tags: { include: { tag: true } },
      categories: true,
      variants: {
        orderBy: { position: 'asc' },
        include: { prices: true },
      },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });

  const matchedIds = products
    .filter((product) => productMatchesCollectionRules(product, rules))
    .map((product) => product.id);

  await setCollectionProducts(collectionId, matchedIds);
  return { count: matchedIds.length };
}

export async function deleteCollection(id) {
  return prisma.collection.delete({ where: { id } });
}

export async function listAllProductTags() {
  return prisma.productTag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
