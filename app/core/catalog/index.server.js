// app/core/catalog/index.server.js
// Catalog service: product/variant/category CRUD, slug resolution, translations, media.

import { getCachedResult, invalidateCachePrefix } from '#/utils/cache.server';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import {
  applyChannelPricesToProducts,
  buildChannelPublishedWhere,
  isProductPublishedOnChannel,
} from '#/core/channels/index.server';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Build a { [field]: value } map from a Translation query result.
function toTranslationMap(rows) {
  return Object.fromEntries(rows.map((r) => [r.field, r.value]));
}

// Merge translation fields into a base object when translations exist.
function withTranslations(base, translationMap) {
  return { ...base, ...translationMap };
}

function catalogCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`;
}

function invalidateCatalogCache() {
  invalidateCachePrefix('catalog:');
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export async function setTranslation(
  entityType,
  entityId,
  locale,
  field,
  value
) {
  await prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: { entityType, entityId, locale, field },
    },
    create: { entityType, entityId, locale, field, value },
    update: { value },
  });
}

export async function getTranslations(entityType, entityId, locale) {
  const rows = await prisma.translation.findMany({
    where: { entityType, entityId, locale },
  });
  return toTranslationMap(rows);
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

export async function setSlug(entityType, entityId, locale, slug) {
  // Reject if this slug string is already claimed by a different entity.
  const existing = await prisma.slug.findUnique({ where: { slug } });
  if (
    existing &&
    (existing.entityType !== entityType || existing.entityId !== entityId)
  ) {
    throw new Error('Slug already taken');
  }

  // Upsert by the compound unique (entityType, entityId, locale) — the schema
  // allows only one slug row per entity+locale, so there is nothing to un-canonicalize.
  await prisma.slug.upsert({
    where: { entityType_entityId_locale: { entityType, entityId, locale } },
    create: { entityType, entityId, locale, slug, canonical: true },
    update: { slug, canonical: true },
  });
}

export async function resolveSlug(slug) {
  const row = await prisma.slug.findUnique({ where: { slug } });
  if (!row) return null;
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    locale: row.locale,
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts({
  locale,
  currency,
  categoryId,
  channelId,
  page = 1,
  limit = 20,
  published,
} = {}) {
  return getCachedResult(
    catalogCacheKey('catalog:products', {
      locale,
      currency,
      categoryId,
      channelId,
      page,
      limit,
      published,
    }),
    async () => {
      const where = {};
      if (published === true) where.publishedAt = { not: null };
      if (published === false) where.publishedAt = null;
      if (categoryId) where.categories = { some: { categoryId } };

      const channelWhere = buildChannelPublishedWhere(channelId);
      if (Object.keys(channelWhere).length > 0) {
        where.AND = [...(where.AND ?? []), channelWhere];
      }

      const skip = (page - 1) * limit;

      const [rawProducts, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          include: {
            variants: {
              orderBy: { position: 'asc' },
              take: 1,
              include: {
                prices: currency ? { where: { currency } } : true,
              },
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

      if (!locale) {
        const products = await applyChannelPricesToProducts(
          rawProducts,
          channelId,
          currency
        );
        return { products, total };
      }

      const products = await Promise.all(
        rawProducts.map(async (product) => {
          const [translations, slugRow] = await Promise.all([
            getTranslations('product', product.id, locale),
            prisma.slug.findFirst({
              where: {
                entityType: 'product',
                entityId: product.id,
                locale,
                canonical: true,
              },
            }),
          ]);
          return withTranslations(
            { ...product, slug: slugRow?.slug ?? null },
            translations
          );
        })
      );

      return {
        products: await applyChannelPricesToProducts(
          products,
          channelId,
          currency
        ),
        total,
      };
    },
    5 * 60 * 1000
  );
}

export async function getProduct(id, { locale, currency, channelId } = {}) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        orderBy: { position: 'asc' },
        include: {
          prices: currency ? { where: { currency } } : true,
        },
      },
      options: {
        orderBy: { position: 'asc' },
        include: {
          values: { orderBy: { position: 'asc' } },
        },
      },
      media: {
        orderBy: { position: 'asc' },
        include: { media: true },
      },
      categories: {
        include: { category: true },
      },
    },
  });

  if (!product) return null;

  if (channelId) {
    const published = await isProductPublishedOnChannel(id, channelId);
    if (!published) return null;
  }

  if (!locale) {
    const [withPrices] = await applyChannelPricesToProducts(
      [product],
      channelId,
      currency
    );
    return withPrices;
  }

  const [translations, slugRow] = await Promise.all([
    getTranslations('product', id, locale),
    prisma.slug.findFirst({
      where: { entityType: 'product', entityId: id, locale, canonical: true },
    }),
  ]);

  const [withPrices] = await applyChannelPricesToProducts(
    [
      withTranslations(
        { ...product, slug: slugRow?.slug ?? null },
        translations
      ),
    ],
    channelId,
    currency
  );
  return withPrices;
}

export async function getProductBySlug(slug, opts = {}) {
  const resolved = await resolveSlug(slug);
  if (!resolved || resolved.entityType !== 'product') return null;
  return getProduct(resolved.entityId, opts);
}

export async function createProduct(data) {
  // prices are managed per-variant via createVariant/updateVariant.
  const { title, description, locale, prices, ...productData } = data;
  if (prices !== undefined) {
    throw new Error(
      'prices must be set per-variant via createVariant/updateVariant, not createProduct'
    );
  }

  const product = await prisma.product.create({ data: productData });

  if (locale && title) {
    await setTranslation('product', product.id, locale, 'title', title);
  }
  if (locale && description) {
    await setTranslation(
      'product',
      product.id,
      locale,
      'description',
      description
    );
  }

  logger.info({ productId: product.id }, 'product created');
  invalidateCatalogCache();
  return product;
}

export async function updateProduct(id, data) {
  const { title, description, locale, ...productData } = data;

  const product = await prisma.product.update({
    where: { id },
    data: productData,
  });

  if (locale && title !== undefined) {
    await setTranslation('product', id, locale, 'title', title);
  }
  if (locale && description !== undefined) {
    await setTranslation('product', id, locale, 'description', description);
  }

  invalidateCatalogCache();
  return product;
}

export async function deleteProduct(id) {
  await prisma.product.delete({ where: { id } });
  invalidateCatalogCache();
  logger.info({ productId: id }, 'product deleted');
}

export async function publishProduct(id) {
  const product = await prisma.product.update({
    where: { id },
    data: { publishedAt: new Date() },
  });
  invalidateCatalogCache();
  return product;
}

export async function unpublishProduct(id) {
  const product = await prisma.product.update({
    where: { id },
    data: { publishedAt: null },
  });
  invalidateCatalogCache();
  return product;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function createVariant(productId, data) {
  const { prices, ...variantData } = data;

  const variant = await prisma.productVariant.create({
    data: { ...variantData, productId },
  });

  if (prices?.length) {
    await prisma.$transaction(
      prices.map(({ currency, priceCents, comparePriceCents }) =>
        prisma.variantPrice.upsert({
          where: { variantId_currency: { variantId: variant.id, currency } },
          create: {
            variantId: variant.id,
            currency,
            priceCents,
            comparePriceCents,
          },
          update: { priceCents, comparePriceCents },
        })
      )
    );
  }

  invalidateCatalogCache();
  return variant;
}

export async function updateVariant(variantId, data) {
  const { prices, ...variantData } = data;

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: variantData,
  });

  if (prices?.length) {
    await prisma.$transaction(
      prices.map(({ currency, priceCents, comparePriceCents }) =>
        prisma.variantPrice.upsert({
          where: { variantId_currency: { variantId, currency } },
          create: { variantId, currency, priceCents, comparePriceCents },
          update: { priceCents, comparePriceCents },
        })
      )
    );
  }

  invalidateCatalogCache();
  return variant;
}

export async function deleteVariant(variantId) {
  await prisma.productVariant.delete({ where: { id: variantId } });
  invalidateCatalogCache();
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories({ locale } = {}) {
  return getCachedResult(
    catalogCacheKey('catalog:categories', { locale }),
    async () => {
      const categories = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: { position: 'asc' },
        include: {
          children: {
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!locale) return categories;

      // Collect all category IDs (parents + children) so we can batch-fetch
      // translations and slugs in just two queries per tier.
      const parentIds = categories.map((c) => c.id);
      const childIds = categories.flatMap((c) => c.children.map((ch) => ch.id));
      const allIds = [...parentIds, ...childIds];

      const [allTranslationRows, allSlugRows] = await Promise.all([
        prisma.translation.findMany({
          where: { entityType: 'category', entityId: { in: allIds }, locale },
        }),
        prisma.slug.findMany({
          where: {
            entityType: 'category',
            entityId: { in: allIds },
            locale,
            canonical: true,
          },
        }),
      ]);

      // Index by entityId for O(1) lookup.
      const translationsByEntity = {};
      for (const row of allTranslationRows) {
        (translationsByEntity[row.entityId] ??= []).push(row);
      }
      const slugByEntity = Object.fromEntries(
        allSlugRows.map((r) => [r.entityId, r.slug])
      );

      return categories.map((cat) => {
        const translatedChildren = cat.children.map((child) => {
          const childTranslations = toTranslationMap(
            translationsByEntity[child.id] ?? []
          );
          return withTranslations(
            { ...child, slug: slugByEntity[child.id] ?? null },
            childTranslations
          );
        });
        const catTranslations = toTranslationMap(
          translationsByEntity[cat.id] ?? []
        );
        return withTranslations(
          {
            ...cat,
            slug: slugByEntity[cat.id] ?? null,
            children: translatedChildren,
          },
          catTranslations
        );
      });
    },
    5 * 60 * 1000
  );
}

export async function getCategory(id, { locale } = {}) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: { orderBy: { position: 'asc' } },
      products: {
        include: { product: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!category) return null;
  if (!locale) return category;

  const [translations, slugRow] = await Promise.all([
    getTranslations('category', id, locale),
    prisma.slug.findFirst({
      where: { entityType: 'category', entityId: id, locale, canonical: true },
    }),
  ]);

  return withTranslations(
    { ...category, slug: slugRow?.slug ?? null },
    translations
  );
}

export async function getCategoryBySlug(slug, opts = {}) {
  const resolved = await resolveSlug(slug);
  if (!resolved || resolved.entityType !== 'category') return null;
  return getCategory(resolved.entityId, opts);
}

export async function createCategory(data) {
  const { name, locale, slug: slugValue, ...categoryData } = data;

  const category = await prisma.category.create({ data: categoryData });

  if (locale && name) {
    await setTranslation('category', category.id, locale, 'name', name);
  }
  if (locale && slugValue) {
    await setSlug('category', category.id, locale, slugValue);
  }

  logger.info({ categoryId: category.id }, 'category created');
  invalidateCatalogCache();
  return category;
}

export async function updateCategory(id, data) {
  const { name, locale, slug: slugValue, ...categoryData } = data;

  const category = await prisma.category.update({
    where: { id },
    data: categoryData,
  });

  if (locale && name !== undefined) {
    await setTranslation('category', id, locale, 'name', name);
  }
  if (locale && slugValue) {
    await setSlug('category', id, locale, slugValue);
  }

  invalidateCatalogCache();
  return category;
}

export async function deleteCategory(id) {
  await prisma.category.delete({ where: { id } });
  invalidateCatalogCache();
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function attachMedia(productId, mediaId, position = 0) {
  return prisma.productMedia.upsert({
    where: { productId_mediaId: { productId, mediaId } },
    create: { productId, mediaId, position },
    update: { position },
  });
}

export async function detachMedia(productId, mediaId) {
  await prisma.productMedia.delete({
    where: { productId_mediaId: { productId, mediaId } },
  });
}

export async function reorderMedia(productId, mediaIds) {
  await prisma.$transaction(
    mediaIds.map((mediaId, index) =>
      prisma.productMedia.update({
        where: { productId_mediaId: { productId, mediaId } },
        data: { position: index },
      })
    )
  );
}
