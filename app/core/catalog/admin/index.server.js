// Admin catalog loaders and mutations for HTML admin routes.

import prisma from '#/libs/prisma.server';
import { setSlug } from '#/core/catalog/index.server';
import {
  loadCategoryTitleMap,
  loadProductTitleMap,
  setTranslation,
} from '#/core/catalog/translations.server';
import { get } from '#/core/settings/index.server';

const DEFAULT_LIST_LOCALE = 'en';

/**
 * Load paginated product rows for the admin products index.
 *
 * @param {{ page?: number, limit?: number, q?: string }} params
 */
export async function loadProductsAdminIndexData({
  page = 1,
  limit = 20,
  q = '',
} = {}) {
  const search = q.trim();
  let productIds = null;

  if (search) {
    const slugRows = await prisma.slug.findMany({
      where: {
        entityType: 'product',
        slug: { contains: search },
      },
      select: { entityId: true },
    });
    productIds = slugRows.map((row) => row.entityId);
  }

  const whereClause = productIds !== null ? { id: { in: productIds } } : {};

  const [total, publishedCount, draftCount, products] = await Promise.all([
    prisma.product.count({ where: whereClause }),
    prisma.product.count({
      where: { ...whereClause, publishedAt: { not: null } },
    }),
    prisma.product.count({
      where: { ...whereClause, publishedAt: null },
    }),
    prisma.product.findMany({
      where: whereClause,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        variants: { select: { id: true } },
        categories: {
          include: {
            category: true,
          },
        },
      },
    }),
  ]);

  const categoryIds = [
    ...new Set(
      products.flatMap((product) => product.categories.map((c) => c.categoryId))
    ),
  ];
  const productIdList = products.map((product) => product.id);

  const [catTitleMap, productTitleMap, slugRows] = await Promise.all([
    loadCategoryTitleMap(categoryIds, DEFAULT_LIST_LOCALE),
    loadProductTitleMap(productIdList, DEFAULT_LIST_LOCALE),
    productIdList.length > 0
      ? prisma.slug.findMany({
          where: {
            entityType: 'product',
            entityId: { in: productIdList },
            locale: DEFAULT_LIST_LOCALE,
          },
        })
      : [],
  ]);

  const slugMap = Object.fromEntries(
    slugRows.map((row) => [row.entityId, row.slug])
  );

  const rows = products.map((product) => ({
    id: product.id,
    idPrefix: product.id.slice(0, 8),
    slug: slugMap[product.id] ?? null,
    title: productTitleMap.get(product.id) ?? null,
    published: product.publishedAt !== null,
    publishedAt: product.publishedAt?.toISOString() ?? null,
    variantCount: product.variants.length,
    categories: product.categories.map((category) => ({
      id: category.categoryId,
      title:
        catTitleMap.get(category.categoryId) ?? category.categoryId.slice(0, 6),
    })),
    createdAt: product.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    publishedCount,
    draftCount,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
    q: search,
  };
}

/**
 * Load product editor payload for the admin product detail route.
 *
 * @param {string} id
 */
export async function loadAdminProductEditorData(id) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id },
    include: {
      variants: {
        orderBy: { position: 'asc' },
        include: { prices: true },
      },
      options: {
        orderBy: { position: 'asc' },
        include: {
          values: { orderBy: { position: 'asc' } },
        },
      },
      categories: {
        orderBy: { position: 'asc' },
        select: { categoryId: true },
      },
      media: {
        orderBy: { position: 'asc' },
        include: { media: true },
      },
    },
  });

  const [translations, slugRows] = await Promise.all([
    prisma.translation.findMany({
      where: { entityType: 'product', entityId: id },
    }),
    prisma.slug.findMany({
      where: { entityType: 'product', entityId: id },
    }),
  ]);

  const translationMap = {};
  for (const row of translations) {
    if (!translationMap[row.locale]) translationMap[row.locale] = {};
    translationMap[row.locale][row.field] = row.value;
  }

  const slugMap = Object.fromEntries(
    slugRows.map((row) => [row.locale, row.slug])
  );

  return {
    product: {
      id: product.id,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku ?? '',
        inventoryCount: variant.inventoryCount,
        inventoryTracked: variant.inventoryTracked,
        position: variant.position,
        prices: Object.fromEntries(
          variant.prices.map((price) => [
            price.currency,
            {
              priceCents: price.priceCents,
              comparePriceCents: price.comparePriceCents ?? '',
            },
          ])
        ),
      })),
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        position: option.position,
        values: option.values.map((value) => ({
          id: value.id,
          value: value.value,
        })),
      })),
      selectedCategoryIds: product.categories.map(
        (category) => category.categoryId
      ),
      media: product.media.map((productMedia) => ({
        productMediaId: productMedia.id,
        mediaId: productMedia.mediaId,
        url: productMedia.media.url,
        altText: productMedia.media.altText ?? '',
        position: productMedia.position,
      })),
    },
    translationMap,
    slugMap,
  };
}

async function loadCategoryAdminLocales() {
  const localesRaw = await get('locales');
  const locales = Array.isArray(localesRaw) ? [...localesRaw] : ['en'];

  if (!locales.includes('en')) {
    locales.unshift('en');
  }

  return locales;
}

async function loadCategoryAdminRecords() {
  const categories = await prisma.category.findMany({
    orderBy: { position: 'asc' },
  });

  const categoryIds = categories.map((category) => category.id);
  const [translations, slugRows] =
    categoryIds.length > 0
      ? await Promise.all([
          prisma.translation.findMany({
            where: { entityType: 'category', entityId: { in: categoryIds } },
          }),
          prisma.slug.findMany({
            where: { entityType: 'category', entityId: { in: categoryIds } },
          }),
        ])
      : [[], []];

  const translationMap = {};
  for (const row of translations) {
    if (!translationMap[row.entityId]) translationMap[row.entityId] = {};
    if (!translationMap[row.entityId][row.locale]) {
      translationMap[row.entityId][row.locale] = {};
    }
    translationMap[row.entityId][row.locale][row.field] = row.value;
  }

  const slugMap = {};
  for (const row of slugRows) {
    if (!slugMap[row.entityId]) slugMap[row.entityId] = {};
    slugMap[row.entityId][row.locale] = row.slug;
  }

  return { categories, translationMap, slugMap };
}

function buildCategoryAdminTree(
  categories,
  translationMap,
  slugMap,
  parentId = null,
  depth = 0
) {
  return categories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.position - b.position)
    .flatMap((category) => [
      {
        id: category.id,
        parentId: category.parentId ?? null,
        position: category.position,
        depth,
        enTitle: translationMap[category.id]?.en?.title ?? '',
        childCount: categories.filter((child) => child.parentId === category.id)
          .length,
        translations: translationMap[category.id] ?? {},
        slugs: slugMap[category.id] ?? {},
      },
      ...buildCategoryAdminTree(
        categories,
        translationMap,
        slugMap,
        category.id,
        depth + 1
      ),
    ]);
}

/**
 * Load category tree data for the admin categories index.
 */
export async function loadCategoryAdminTreeData() {
  const [locales, { categories, translationMap, slugMap }] = await Promise.all([
    loadCategoryAdminLocales(),
    loadCategoryAdminRecords(),
  ]);

  return {
    tree: buildCategoryAdminTree(categories, translationMap, slugMap),
    locales,
  };
}

/**
 * Load parent category options for the new-category form.
 */
export async function loadCategoryAdminSelectOptions() {
  const { categories, translationMap } = await loadCategoryAdminRecords();

  return {
    allForSelect: categories.map((category) => ({
      id: category.id,
      title:
        translationMap[category.id]?.en?.title ??
        `(${category.id.slice(0, 6)})`,
    })),
  };
}

/**
 * Load a single category for the admin edit page.
 *
 * @param {string} id
 * @returns {Promise<{ category: object, locales: string[], allForSelect: Array<{ id: string, title: string }> } | null>}
 */
export async function loadCategoryAdminEditData(id) {
  const [locales, { categories, translationMap, slugMap }] = await Promise.all([
    loadCategoryAdminLocales(),
    loadCategoryAdminRecords(),
  ]);

  const record = categories.find((category) => category.id === id);
  if (!record) return null;

  return {
    category: {
      id: record.id,
      parentId: record.parentId ?? null,
      position: record.position,
      enTitle: translationMap[record.id]?.en?.title ?? '',
      translations: translationMap[record.id] ?? {},
      slugs: slugMap[record.id] ?? {},
    },
    locales,
    allForSelect: categories
      .filter((category) => category.id !== id)
      .map((category) => ({
        id: category.id,
        title:
          translationMap[category.id]?.en?.title ??
          `(${category.id.slice(0, 6)})`,
      })),
  };
}

/**
 * Parse create-category form input.
 *
 * @param {FormData} formData
 * @returns {{ data?: { title: string, slugValue: string, parentId: string|null }, error?: string }}
 */
export function parseCategoryCreateInput(formData) {
  const title = formData.get('title')?.toString().trim() ?? '';
  const slugValue = formData.get('slug')?.toString().trim() ?? '';
  const parentId = formData.get('parentId')?.toString().trim() || null;

  if (!title) {
    return { error: 'Name is required.' };
  }

  return { data: { title, slugValue, parentId } };
}

/**
 * Create a category from admin form input.
 *
 * @param {{ title: string, slugValue: string, parentId: string|null }} input
 */
export async function createCategoryFromAdminInput(input) {
  const lastSibling = await prisma.category.findFirst({
    where: { parentId: input.parentId },
    orderBy: { position: 'desc' },
  });
  const position = (lastSibling?.position ?? -1) + 1;

  const category = await prisma.category.create({
    data: { parentId: input.parentId, position },
  });

  await setTranslation(
    'category',
    category.id,
    DEFAULT_LIST_LOCALE,
    'title',
    input.title
  );

  if (input.slugValue) {
    try {
      await setSlug(
        'category',
        category.id,
        DEFAULT_LIST_LOCALE,
        input.slugValue
      );
    } catch {
      // Slug collision — category still created
    }
  }

  return category;
}

/**
 * Persist inline category edit form fields.
 *
 * @param {string} id
 * @param {FormData} formData
 */
export async function saveCategoryAdminForm(id, formData) {
  const locales = formData.getAll('locales[]');

  for (const locale of locales) {
    const title = formData.get(`title[${locale}]`)?.toString() ?? '';
    const slugValue = formData.get(`slug[${locale}]`)?.toString().trim();
    const metaTitle = formData.get(`metaTitle[${locale}]`)?.toString() ?? '';
    const metaDescription =
      formData.get(`metaDescription[${locale}]`)?.toString() ?? '';

    for (const [field, value] of [
      ['title', title],
      ['metaTitle', metaTitle],
      ['metaDescription', metaDescription],
    ]) {
      await setTranslation('category', id, locale, field, value);
    }

    if (slugValue) {
      try {
        await setSlug('category', id, locale, slugValue);
      } catch {
        // Slug collision — skip
      }
    }
  }
}

/**
 * Delete a category and all descendants.
 *
 * @param {string} id
 */
export async function deleteCategoryRecursive(id) {
  async function deleteNode(categoryId) {
    const children = await prisma.category.findMany({
      where: { parentId: categoryId },
    });

    for (const child of children) {
      await deleteNode(child.id);
    }

    await prisma.translation.deleteMany({
      where: { entityType: 'category', entityId: categoryId },
    });
    await prisma.slug.deleteMany({
      where: { entityType: 'category', entityId: categoryId },
    });
    await prisma.category.delete({ where: { id: categoryId } });
  }

  await deleteNode(id);
}

/**
 * Persist sibling order for categories that share the same parent.
 *
 * @param {string | null} parentId
 * @param {string[]} orderedIds
 */
export async function setCategorySiblingOrder(parentId, orderedIds) {
  if (!orderedIds.length) return;

  const siblings = await prisma.category.findMany({
    where: { parentId: parentId ?? null },
    orderBy: { position: 'asc' },
  });

  const siblingIds = new Set(siblings.map((sibling) => sibling.id));
  const incomingIds = new Set(orderedIds);

  if (
    siblingIds.size !== incomingIds.size ||
    orderedIds.some((id) => !siblingIds.has(id))
  ) {
    throw Object.assign(new Error('Invalid category order.'), {
      code: 'INVALID_ORDER',
    });
  }

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.category.update({
        where: { id },
        data: { position },
      })
    )
  );
}

/**
 * Move a category up or down among its siblings.
 *
 * @param {string} id
 * @param {'reorder-up'|'reorder-down'} intent
 * @returns {{ moved: boolean }}
 */
export async function reorderCategory(id, intent) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) {
    throw Object.assign(new Error('Category not found.'), {
      code: 'NOT_FOUND',
    });
  }

  const siblings = await prisma.category.findMany({
    where: { parentId: current.parentId ?? null },
    orderBy: { position: 'asc' },
  });

  const idx = siblings.findIndex((sibling) => sibling.id === id);
  const swapIdx = intent === 'reorder-up' ? idx - 1 : idx + 1;

  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return { moved: false };
  }

  const sibling = siblings[swapIdx];

  await prisma.$transaction([
    prisma.category.update({
      where: { id: current.id },
      data: { position: sibling.position },
    }),
    prisma.category.update({
      where: { id: sibling.id },
      data: { position: current.position },
    }),
  ]);

  return { moved: true };
}
