// app/core/search/index.server.js
// Search provider registry + built-in database provider (W1).
//
// Provider interface:
//   provider.search({ query, filters, sort, page, limit, locale, currency })
//   → Promise<{ products: Array, total: number, facets: Object }>
//
// filters shape:
//   {
//     categoryId?: string,
//     productIds?: string[], // scope results to these product IDs
//     channelId?: string,    // sales channel publish filter + price overrides
//     priceMin?: number,   // cents
//     priceMax?: number,   // cents
//     inStock?: boolean,
//     attributes?: Record<string, string[]>  // { "Color": ["Red", "Blue"] }
//   }
//
// facets shape:
//   {
//     categories: { id, name, count }[],
//     price: { min, max },           // cents
//     attributes: { name, values: { value, count }[] }[],
//     availability: { inStock, total }
//   }

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters/index.server';
import { localizeEntity } from '#/core/catalog/locale.server';
import {
  applyChannelPricesToProducts,
  buildChannelPublishedWhere,
} from '#/core/channels/index.server';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();
let _defaultProviderId = null;

/**
 * Register a search provider under the given id. The first registered provider
 * becomes the default unless `isDefault: false` is explicitly passed.
 *
 * @param {string} id
 * @param {Object} provider
 * @param {{ isDefault?: boolean }} [options]
 */
export function registerProvider(id, provider, { isDefault = false } = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('Provider id must be a non-empty string');
  }
  if (!provider || typeof provider !== 'object') {
    throw new Error('Provider must be an object');
  }
  _registry.set(id, provider);
  if (isDefault || _defaultProviderId === null) {
    _defaultProviderId = id;
  }
}

/**
 * Remove a registered search provider by id.
 *
 * @param {string} id
 */
export function unregisterProvider(id) {
  if (!_registry.has(id)) return;

  _registry.delete(id);
  if (_defaultProviderId === id) {
    _defaultProviderId = _registry.keys().next().value ?? null;
  }
}

/**
 * Get a registered search provider by id. Throws if not found.
 *
 * @param {string} id
 * @returns {Object}
 */
export function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Search provider "${id}" is not registered`);
  }
  return provider;
}

/**
 * Override the active default search provider.
 *
 * @param {string} id
 */
export function setDefaultProvider(id) {
  if (!_registry.has(id)) {
    throw new Error(`Search provider "${id}" is not registered`);
  }
  _defaultProviderId = id;
}

/**
 * Return the current default provider id, or null when none is set.
 *
 * @returns {string | null}
 */
export function getDefaultProviderId() {
  return _defaultProviderId;
}

// ---------------------------------------------------------------------------
// search — public entry points
// ---------------------------------------------------------------------------

/**
 * Search products using the registered default provider.
 *
 * @param {Object} params
 * @returns {Promise<{ products: Array, total: number, facets: Object }>}
 */
export function search(params) {
  if (!_defaultProviderId) {
    throw new Error('No search provider registered');
  }
  return getProvider(_defaultProviderId).search(params);
}

// ---------------------------------------------------------------------------
// Internal helpers shared with the built-in DB provider
// ---------------------------------------------------------------------------

async function hydrateProduct(product, locale) {
  return localizeEntity('product', product.id, locale, product);
}

async function hydrateProducts(rawProducts, locale) {
  if (!locale || !rawProducts.length) return rawProducts;
  return Promise.all(rawProducts.map((p) => hydrateProduct(p, locale)));
}

/**
 * Return product IDs whose translations (title/description) or SKUs match the
 * query string. Returns null when the query is blank (= no text filter).
 *
 * SQLite: `contains` is case-insensitive for ASCII by default.
 * Postgres: uses `mode: 'insensitive'` via containsFilter().
 *
 * @param {string} query
 * @param {string|undefined} locale
 * @returns {Promise<string[]|null>}
 */
async function getTextMatchIds(query, locale) {
  if (!query?.trim()) return null;
  const q = query.trim();

  const [translationRows, variantRows] = await Promise.all([
    prisma.translation.findMany({
      where: {
        entityType: 'product',
        ...(locale ? { locale } : {}),
        value: containsFilter(q),
      },
      select: { entityId: true },
    }),
    prisma.productVariant.findMany({
      where: { sku: containsFilter(q) },
      select: { productId: true },
    }),
  ]);

  return [
    ...new Set([
      ...translationRows.map((r) => r.entityId),
      ...variantRows.map((r) => r.productId),
    ]),
  ];
}

/**
 * Return product IDs whose variant prices fall within [priceMin, priceMax].
 * Returns null when no price bounds are given.
 *
 * @param {number|undefined} priceMin - cents
 * @param {number|undefined} priceMax - cents
 * @param {string|undefined} currency
 * @returns {Promise<string[]|null>}
 */
async function getPriceMatchIds(priceMin, priceMax, currency) {
  if (priceMin == null && priceMax == null) return null;

  const priceWhere = {};
  if (currency) priceWhere.currency = currency;
  if (priceMin != null) priceWhere.priceCents = { gte: priceMin };
  if (priceMax != null) {
    priceWhere.priceCents = { ...(priceWhere.priceCents ?? {}), lte: priceMax };
  }

  const rows = await prisma.variantPrice.findMany({
    where: priceWhere,
    select: { variant: { select: { productId: true } } },
  });

  return [...new Set(rows.map((r) => r.variant.productId))];
}

/**
 * Intersect two nullable ID sets.
 * null means "no filter for this axis" (match all).
 *
 * @param {string[]|null} a
 * @param {string[]|null} b
 * @returns {string[]|null}
 */
function intersectIds(a, b) {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

const ORDER_BY = {
  relevance: [{ position: 'asc' }, { createdAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  // price_asc / price_desc are sorted client-side after fetch so that results
  // reflect the currency-selected price rather than a non-deterministic join.
  price_asc: [{ position: 'asc' }],
  price_desc: [{ position: 'asc' }],
};

async function fetchPage({ where, sort, page, limit, currency }) {
  const orderBy = ORDER_BY[sort] ?? ORDER_BY.relevance;
  const skip = (page - 1) * limit;

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        variants: {
          orderBy: { position: 'asc' },
          take: 1,
          include: { prices: currency ? { where: { currency } } : true },
        },
        media: {
          orderBy: { position: 'asc' },
          take: 1,
          include: { media: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  if (sort === 'price_asc') {
    rawProducts.sort(
      (a, b) =>
        (a.variants[0]?.prices?.[0]?.priceCents ?? Infinity) -
        (b.variants[0]?.prices?.[0]?.priceCents ?? Infinity)
    );
  } else if (sort === 'price_desc') {
    rawProducts.sort(
      (a, b) =>
        (b.variants[0]?.prices?.[0]?.priceCents ?? -Infinity) -
        (a.variants[0]?.prices?.[0]?.priceCents ?? -Infinity)
    );
  }

  return { products: rawProducts, total };
}

async function buildFacets({ where, currency, locale }) {
  const allProducts = await prisma.product.findMany({
    where,
    include: {
      categories: { include: { category: { select: { id: true } } } },
      variants: {
        include: {
          prices: currency ? { where: { currency } } : true,
        },
      },
      attributes: { include: { values: true } },
    },
  });

  // --- Category facets ---
  const catCountMap = {};
  for (const p of allProducts) {
    for (const pc of p.categories) {
      catCountMap[pc.categoryId] = (catCountMap[pc.categoryId] ?? 0) + 1;
    }
  }

  const catIds = Object.keys(catCountMap);
  const catTranslations = locale
    ? await prisma.translation.findMany({
        where: {
          entityType: 'category',
          entityId: { in: catIds },
          locale,
          field: 'name',
        },
        select: { entityId: true, value: true },
      })
    : [];
  const catNameMap = Object.fromEntries(
    catTranslations.map((t) => [t.entityId, t.value])
  );

  const categories = catIds
    .map((id) => ({
      id,
      name: catNameMap[id] ?? id,
      count: catCountMap[id],
    }))
    .sort((a, b) => b.count - a.count);

  // --- Price facets ---
  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const p of allProducts) {
    for (const v of p.variants) {
      for (const price of v.prices) {
        if (price.priceCents < priceMin) priceMin = price.priceCents;
        if (price.priceCents > priceMax) priceMax = price.priceCents;
      }
    }
  }

  // --- Attribute facets ---
  const attrMap = {};
  for (const p of allProducts) {
    for (const attr of p.attributes) {
      if (!attrMap[attr.name]) attrMap[attr.name] = {};
      for (const av of attr.values) {
        attrMap[attr.name][av.value] = (attrMap[attr.name][av.value] ?? 0) + 1;
      }
    }
  }

  const attributes = Object.entries(attrMap)
    .map(([name, valMap]) => ({
      name,
      values: Object.entries(valMap)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Availability ---
  let inStockCount = 0;
  for (const p of allProducts) {
    if (p.variants.some((v) => !v.inventoryTracked || v.inventoryCount > 0)) {
      inStockCount++;
    }
  }

  return {
    categories,
    price: {
      min: priceMin === Infinity ? 0 : priceMin,
      max: priceMax === -Infinity ? 0 : priceMax,
    },
    attributes,
    availability: { inStock: inStockCount, total: allProducts.length },
  };
}

// ---------------------------------------------------------------------------
// Built-in database search provider
// ---------------------------------------------------------------------------

export const dbProvider = {
  name: 'Database',

  async search({
    query = '',
    filters = {},
    sort = 'relevance',
    page = 1,
    limit = 24,
    locale,
    currency,
  } = {}) {
    const {
      categoryId,
      productIds,
      channelId,
      priceMin,
      priceMax,
      inStock,
      attributes = {},
    } = filters;

    // Resolve ID sets from the two pre-filtering axes (text + price).
    const [textIds, priceIds] = await Promise.all([
      getTextMatchIds(query, locale),
      getPriceMatchIds(priceMin, priceMax, currency),
    ]);
    let idFilter = intersectIds(textIds, priceIds);
    if (Array.isArray(productIds)) {
      idFilter = productIds.length ? intersectIds(idFilter, productIds) : [];
    }

    const where = { publishedAt: { not: null } };
    if (idFilter !== null) {
      where.id = { in: idFilter.length ? idFilter : ['__none__'] };
    }
    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    const channelWhere = buildChannelPublishedWhere(channelId);
    const andConditions = [];
    if (Object.keys(channelWhere).length > 0) {
      andConditions.push(channelWhere);
    }

    if (inStock === true) {
      andConditions.push({
        variants: {
          some: {
            OR: [{ inventoryTracked: false }, { inventoryCount: { gt: 0 } }],
          },
        },
      });
    }

    const attrEntries = Object.entries(attributes).filter(
      ([, vals]) => Array.isArray(vals) && vals.length > 0
    );
    for (const [name, values] of attrEntries) {
      andConditions.push({
        attributes: {
          some: { name, values: { some: { value: { in: values } } } },
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [{ products: rawProducts, total }, facets] = await Promise.all([
      fetchPage({ where, sort, page, limit, currency }),
      buildFacets({ where, currency, locale }),
    ]);

    let products = await hydrateProducts(rawProducts, locale);
    products = await applyChannelPricesToProducts(
      products,
      channelId,
      currency
    );

    logger.debug({ query, total, page, sort, channelId }, 'search:db');

    return { products, total, facets };
  },
};

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };

/** Reset registry state. Test use only — never call in production. */
export function __resetRegistry() {
  _registry.clear();
  _defaultProviderId = null;
}
