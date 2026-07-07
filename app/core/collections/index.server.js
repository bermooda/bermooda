// app/core/collections/index.server.js
// Manual and smart product collections.

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import {
  getTranslations,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import {
  parseCollectionRules,
  parseCollectionRulesFromForm,
  parseCollectionRulesInput,
  productMatchesCollectionRules,
} from '#/core/collections/rules.server';

const COLLECTION_LIST_INCLUDE = {
  _count: { select: { products: true } },
};

// ---------------------------------------------------------------------------
// Search and input helpers
// ---------------------------------------------------------------------------

/**
 * Build a Prisma where clause for collection list search.
 *
 * @param {string} [q]
 * @returns {Promise<object>}
 */
export async function buildCollectionSearchWhere(q) {
  const query = q?.trim();
  if (!query) return {};

  const titleMatches = await prisma.translation.findMany({
    where: {
      entityType: 'collection',
      field: 'title',
      value: containsFilter(query),
    },
    select: { entityId: true },
  });
  const titleIds = titleMatches.map((row) => row.entityId);

  return {
    OR: [
      { handle: containsFilter(query) },
      ...(titleIds.length ? [{ id: { in: titleIds } }] : []),
    ],
  };
}

/**
 * Parse admin/API create payload into normalized collection fields.
 *
 * @param {object} input
 */
export function parseCreateCollectionInput(input = {}) {
  const handle = input.handle?.toString().trim();
  const title = input.title?.toString().trim();
  const description = input.description?.toString().trim() ?? '';
  const collectionType =
    input.collectionType?.toString() === 'smart' ? 'smart' : 'manual';

  let productIds = [];
  if (Array.isArray(input.productIds)) {
    productIds = input.productIds.map((id) => id.toString()).filter(Boolean);
  } else if (typeof input.productIds === 'string' && input.productIds.trim()) {
    productIds = input.productIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const rules =
    collectionType === 'smart' && input.rules
      ? parseCollectionRulesInput(input.rules)
      : null;

  return { handle, title, description, collectionType, productIds, rules };
}

/**
 * Parse admin/API update payload into normalized collection fields.
 *
 * @param {object} input
 */
export function parseUpdateCollectionInput(input = {}) {
  const parsed = {};

  if (input.handle !== undefined) {
    parsed.handle = input.handle?.toString().trim();
  }
  if (input.title !== undefined) {
    parsed.title = input.title?.toString().trim();
  }
  if (input.description !== undefined) {
    parsed.description = input.description?.toString().trim() ?? '';
  }
  if (input.collectionType !== undefined) {
    parsed.collectionType =
      input.collectionType?.toString() === 'smart' ? 'smart' : 'manual';
  }
  if (input.published !== undefined) {
    parsed.published =
      input.published === true ||
      input.published === 'on' ||
      input.published === 'true';
  }
  if (input.productIds !== undefined) {
    parsed.productIds = Array.isArray(input.productIds)
      ? input.productIds.map((id) => id.toString()).filter(Boolean)
      : [];
  }
  if (input.rules !== undefined) {
    parsed.rules = parseCollectionRulesInput(input.rules);
  }

  return parsed;
}

export { parseCollectionRulesFromForm };

async function attachCollectionTitles(collections, locale = 'en') {
  if (!collections.length) return collections;

  const rows = await prisma.translation.findMany({
    where: {
      entityType: 'collection',
      entityId: { in: collections.map((collection) => collection.id) },
      locale,
      field: 'title',
    },
  });
  const titleMap = Object.fromEntries(
    rows.map((row) => [row.entityId, row.value])
  );

  return collections.map((collection) => ({
    ...collection,
    title: titleMap[collection.id] ?? collection.handle,
  }));
}

// ---------------------------------------------------------------------------
// List helpers for admin editor
// ---------------------------------------------------------------------------

/**
 * List product tags for smart collection rules.
 */
export async function listProductTags() {
  return prisma.productTag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/**
 * Categories and tags for the smart collection rules builder.
 *
 * @param {{ locale?: string }} [options]
 */
export async function listCollectionRuleOptions({ locale = 'en' } = {}) {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: 'asc' } }),
    listProductTags(),
  ]);

  const titleRows = await prisma.translation.findMany({
    where: {
      entityType: 'category',
      entityId: { in: categories.map((category) => category.id) },
      locale,
      field: 'title',
    },
  });
  const titleMap = Object.fromEntries(
    titleRows.map((row) => [row.entityId, row.value])
  );

  return {
    categories: categories.map((category) => ({
      id: category.id,
      title: titleMap[category.id] || category.id,
    })),
    tags,
  };
}

/**
 * Products for the manual collection picker in admin.
 *
 * @param {{ locale?: string, selectedProductIds?: string[] }} [options]
 */
export async function listProductsForCollectionPicker({
  locale = 'en',
  selectedProductIds = [],
} = {}) {
  const products = await prisma.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    include: {
      variants: { select: { sku: true }, take: 1 },
    },
  });

  const productIds = products.map((product) => product.id);
  const [slugRows, translationRows] = await Promise.all([
    prisma.slug.findMany({
      where: {
        entityType: 'product',
        entityId: { in: productIds },
        locale,
        canonical: true,
      },
    }),
    prisma.translation.findMany({
      where: {
        entityType: 'product',
        entityId: { in: productIds },
        locale,
        field: 'title',
      },
    }),
  ]);

  const slugMap = Object.fromEntries(
    slugRows.map((row) => [row.entityId, row.slug])
  );
  const titleMap = Object.fromEntries(
    translationRows.map((row) => [row.entityId, row.value])
  );
  const selected = new Set(selectedProductIds);

  return products.map((product) => ({
    id: product.id,
    title: titleMap[product.id] || slugMap[product.id] || product.id,
    sku: product.variants[0]?.sku ?? '',
    selected: selected.has(product.id),
  }));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listCollections({
  publishedOnly = false,
  page = 1,
  limit = 50,
  q,
  locale = 'en',
} = {}) {
  const searchWhere = await buildCollectionSearchWhere(q);
  const where = {
    ...(publishedOnly ? { publishedAt: { not: null } } : {}),
    ...searchWhere,
  };
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: COLLECTION_LIST_INCLUDE,
      skip,
      take: limit,
    }),
    prisma.collection.count({ where }),
  ]);

  const collections = await attachCollectionTitles(rows, locale);
  return { collections, total };
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

export async function createCollection(input) {
  const { handle, title, description, collectionType, productIds, rules } =
    parseCreateCollectionInput(input);

  if (!handle || !title) {
    throw Object.assign(new Error('Handle and title are required.'), {
      code: 'COLLECTION_INVALID',
    });
  }

  const collection = await prisma.collection.create({
    data: {
      handle,
      collectionType,
      rulesJson: rules ? JSON.stringify(rules) : null,
      publishedAt: new Date(),
    },
  });

  await setTranslation('collection', collection.id, 'en', 'title', title);
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

export async function updateCollection(id, input = {}) {
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Collection not found.'), {
      code: 'COLLECTION_NOT_FOUND',
    });
  }

  const parsed = parseUpdateCollectionInput(input);
  if (parsed.handle !== undefined && !parsed.handle) {
    throw Object.assign(new Error('Handle is required.'), {
      code: 'COLLECTION_INVALID',
    });
  }
  if (parsed.title !== undefined && !parsed.title) {
    throw Object.assign(new Error('Title is required.'), {
      code: 'COLLECTION_INVALID',
    });
  }

  const nextType = parsed.collectionType ?? existing.collectionType;
  const nextRules =
    parsed.rules !== undefined
      ? parsed.rules
      : existing.rulesJson
        ? parseCollectionRules(existing.rulesJson)
        : null;

  const collection = await prisma.collection.update({
    where: { id },
    data: {
      ...(parsed.handle !== undefined ? { handle: parsed.handle } : {}),
      ...(parsed.collectionType !== undefined
        ? { collectionType: nextType }
        : {}),
      ...(parsed.rules !== undefined || parsed.collectionType !== undefined
        ? { rulesJson: nextType === 'smart' ? JSON.stringify(nextRules) : null }
        : {}),
      ...(parsed.published === true ? { publishedAt: new Date() } : {}),
      ...(parsed.published === false ? { publishedAt: null } : {}),
    },
  });

  if (parsed.title !== undefined) {
    await setTranslation('collection', id, 'en', 'title', parsed.title);
  }
  if (parsed.description !== undefined) {
    await setTranslation(
      'collection',
      id,
      'en',
      'description',
      parsed.description
    );
  }
  if (parsed.handle !== undefined) {
    await setSlug('collection', id, 'en', parsed.handle);
  }

  if (nextType === 'smart') {
    await refreshSmartCollection(id);
  } else if (parsed.productIds !== undefined) {
    await setCollectionProducts(id, parsed.productIds);
  }

  return collection;
}

async function setCollectionProducts(collectionId, productIds) {
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
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Collection not found.'), {
      code: 'COLLECTION_NOT_FOUND',
    });
  }

  return prisma.collection.delete({ where: { id } });
}
