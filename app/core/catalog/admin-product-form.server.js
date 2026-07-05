// app/core/catalog/admin-product-form.server.js
// Shared admin product form persistence for create and edit routes.

import prisma from '#/libs/prisma.server';

import { publishProduct, unpublishProduct } from '#/core/catalog/index.server';
import { setDefaultLocationQuantity } from '#/core/inventory/locations.server';
import { get } from '#/core/settings/index.server';

/**
 * Load shared editor context (locales, currencies, category list).
 */
export async function loadAdminProductEditorContext() {
  const [localesRaw, currenciesRaw, allCategories] = await Promise.all([
    get('locales'),
    get('currencies'),
    prisma.category.findMany({ orderBy: { position: 'asc' } }),
  ]);

  const locales = Array.isArray(localesRaw) ? localesRaw : ['en'];
  const currencies = Array.isArray(currenciesRaw) ? currenciesRaw : ['USD'];

  const catIds = allCategories.map((c) => c.id);
  const catTranslations =
    catIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'category',
            entityId: { in: catIds },
            locale: 'en',
            field: 'title',
          },
        })
      : [];
  const catTitleMap = Object.fromEntries(
    catTranslations.map((t) => [t.entityId, t.value])
  );

  return {
    locales,
    currencies,
    allCategories: allCategories.map((c) => ({
      id: c.id,
      title: catTitleMap[c.id] ?? `(${c.id.slice(0, 6)})`,
    })),
  };
}

/**
 * Remap placeholder variant ids in form field names to persisted ids.
 *
 * @param {FormData} formData
 * @param {Record<string, string>} variantIdMap
 * @returns {FormData}
 */
function remapVariantIds(formData, variantIdMap) {
  if (Object.keys(variantIdMap).length === 0) return formData;

  const remapped = new FormData();
  for (const [key, value] of formData.entries()) {
    let nextKey = key;
    for (const [placeholder, persistedId] of Object.entries(variantIdMap)) {
      nextKey = nextKey.replaceAll(placeholder, persistedId);
    }
    remapped.append(nextKey, value);
  }
  return remapped;
}

/**
 * Persist admin product form fields (translations, slugs, categories, options, variants).
 *
 * @param {string} productId
 * @param {FormData} formData
 * @param {{ variantIdMap?: Record<string, string> }} [options]
 */
export async function persistAdminProduct(productId, formData, options = {}) {
  const data = remapVariantIds(formData, options.variantIdMap ?? {});

  const locales = data.getAll('locales[]');

  const publish = data.get('publishedAt');
  if (publish === 'publish') {
    await publishProduct(productId);
  } else if (publish === 'unpublish') {
    await unpublishProduct(productId);
  }

  for (const locale of locales) {
    const fields = ['title', 'description', 'seoTitle', 'seoDescription'];
    for (const field of fields) {
      const value = data.get(`translation[${locale}][${field}]`) ?? '';
      await prisma.translation.upsert({
        where: {
          entityType_entityId_locale_field: {
            entityType: 'product',
            entityId: productId,
            locale,
            field,
          },
        },
        update: { value },
        create: {
          entityType: 'product',
          entityId: productId,
          locale,
          field,
          value,
        },
      });
    }

    const slugValue = data.get(`slug[${locale}]`)?.toString().trim();
    if (slugValue) {
      try {
        await prisma.slug.upsert({
          where: {
            entityType_entityId_locale: {
              entityType: 'product',
              entityId: productId,
              locale,
            },
          },
          update: { slug: slugValue },
          create: {
            entityType: 'product',
            entityId: productId,
            locale,
            slug: slugValue,
          },
        });
      } catch {
        // Slug collision — skip silently (unique constraint)
      }
    }
  }

  const selectedCatIds = data.getAll('categoryIds[]');
  await prisma.productCategory.deleteMany({
    where: {
      productId,
      categoryId: { notIn: selectedCatIds },
    },
  });
  for (let i = 0; i < selectedCatIds.length; i++) {
    await prisma.productCategory.upsert({
      where: {
        productId_categoryId: {
          productId,
          categoryId: selectedCatIds[i],
        },
      },
      update: { position: i },
      create: { productId, categoryId: selectedCatIds[i], position: i },
    });
  }

  const submittedOptionKeys = [...data.keys()].filter((k) =>
    k.startsWith('option[')
  );
  const optionDataMap = {};
  for (const key of submittedOptionKeys) {
    const match = key.match(/^option\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!match) continue;
    const [, optId, field] = match;
    if (!optionDataMap[optId]) optionDataMap[optId] = { values: [] };
    optionDataMap[optId][field] = data.get(key);
  }

  const optionValueKeys = [...data.keys()].filter((k) =>
    k.startsWith('optionValue[')
  );
  for (const key of optionValueKeys) {
    const match = key.match(/^optionValue\[([^\]]+)\]\[(\d+)\]$/);
    if (!match) continue;
    const [, optId, idxStr] = match;
    const idx = parseInt(idxStr, 10);
    if (!optionDataMap[optId]) optionDataMap[optId] = { values: [] };
    if (!optionDataMap[optId].values[idx]) {
      optionDataMap[optId].values[idx] = {};
    }
    optionDataMap[optId].values[idx].value = data.get(key);
  }

  const optionValueIdKeys = [...data.keys()].filter((k) =>
    k.startsWith('optionValueId[')
  );
  for (const key of optionValueIdKeys) {
    const match = key.match(/^optionValueId\[([^\]]+)\]\[(\d+)\]$/);
    if (!match) continue;
    const [, optId, idxStr] = match;
    const idx = parseInt(idxStr, 10);
    if (!optionDataMap[optId]) optionDataMap[optId] = { values: [] };
    if (!optionDataMap[optId].values[idx]) {
      optionDataMap[optId].values[idx] = {};
    }
    optionDataMap[optId].values[idx].id = data.get(key);
  }

  const submittedOptionIds = Object.keys(optionDataMap);
  const persistedOptionIds = submittedOptionIds.filter(
    (x) => !x.startsWith('new-')
  );
  await prisma.productOption.deleteMany({
    where: {
      productId,
      id: { notIn: persistedOptionIds },
    },
  });

  for (const [optId, optData] of Object.entries(optionDataMap)) {
    const name = optData.name ?? '';
    let dbOptionId;

    if (optId.startsWith('new-')) {
      const created = await prisma.productOption.create({
        data: { productId, name, position: 0 },
      });
      dbOptionId = created.id;
    } else {
      await prisma.productOption.update({
        where: { id: optId },
        data: { name },
      });
      dbOptionId = optId;
    }

    const submittedValueIds = (optData.values ?? [])
      .map((v) => v?.id)
      .filter((v) => v && !v.startsWith('new-'));

    await prisma.productOptionValue.deleteMany({
      where: {
        optionId: dbOptionId,
        id: { notIn: submittedValueIds },
      },
    });

    for (let vi = 0; vi < (optData.values ?? []).length; vi++) {
      const valData = optData.values[vi];
      if (!valData?.value) continue;
      const valId = valData.id;

      if (!valId || valId.startsWith('new-')) {
        await prisma.productOptionValue.create({
          data: { optionId: dbOptionId, value: valData.value, position: vi },
        });
      } else {
        await prisma.productOptionValue.update({
          where: { id: valId },
          data: { value: valData.value, position: vi },
        });
      }
    }
  }

  const variantKeys = [...data.keys()].filter((k) => k.startsWith('variant['));
  const variantDataMap = {};
  for (const key of variantKeys) {
    const match = key.match(/^variant\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!match) continue;
    const [, varId, field] = match;
    if (!variantDataMap[varId]) variantDataMap[varId] = {};
    variantDataMap[varId][field] = data.get(key);
  }

  const priceKeys = [...data.keys()].filter((k) => k.startsWith('price['));
  const comparePriceKeys = [...data.keys()].filter((k) =>
    k.startsWith('comparePrice[')
  );

  const priceDataMap = {};
  for (const key of priceKeys) {
    const match = key.match(/^price\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!match) continue;
    const [, varId, currency] = match;
    if (!priceDataMap[varId]) priceDataMap[varId] = {};
    if (!priceDataMap[varId][currency]) priceDataMap[varId][currency] = {};
    const raw = data.get(key) ?? '';
    const dollars = parseFloat(raw);
    priceDataMap[varId][currency].priceCents = isNaN(dollars)
      ? 0
      : Math.round(dollars * 100);
  }
  for (const key of comparePriceKeys) {
    const match = key.match(/^comparePrice\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!match) continue;
    const [, varId, currency] = match;
    if (!priceDataMap[varId]) priceDataMap[varId] = {};
    if (!priceDataMap[varId][currency]) priceDataMap[varId][currency] = {};
    const raw = data.get(key) ?? '';
    const dollars = parseFloat(raw);
    priceDataMap[varId][currency].comparePriceCents = isNaN(dollars)
      ? null
      : Math.round(dollars * 100);
  }

  for (const [varId, varData] of Object.entries(variantDataMap)) {
    const sku = varData.sku ?? null;
    const inventoryCount = parseInt(varData.inventoryCount ?? '0', 10);

    await prisma.productVariant.update({
      where: { id: varId },
      data: { sku: sku || null },
    });

    await setDefaultLocationQuantity(varId, inventoryCount);

    for (const [currency, priceData] of Object.entries(
      priceDataMap[varId] ?? {}
    )) {
      await prisma.variantPrice.upsert({
        where: { variantId_currency: { variantId: varId, currency } },
        update: {
          priceCents: priceData.priceCents ?? 0,
          comparePriceCents: priceData.comparePriceCents ?? null,
        },
        create: {
          variantId: varId,
          currency,
          priceCents: priceData.priceCents ?? 0,
          comparePriceCents: priceData.comparePriceCents ?? null,
        },
      });
    }
  }
}

/**
 * Validate slug format and uniqueness for the primary locale on create.
 *
 * @param {FormData} formData
 * @param {string} primaryLocale
 * @returns {{ error?: string }}
 */
export async function validatePrimarySlug(formData, primaryLocale) {
  const slug = formData.get(`slug[${primaryLocale}]`)?.toString().trim();

  if (!slug) {
    return { error: 'URL slug is required.' };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      error:
        'Slug must be lowercase letters, numbers and hyphens only (no spaces).',
    };
  }

  const existing = await prisma.slug.findUnique({ where: { slug } });
  if (existing) {
    return { error: `Slug "${slug}" is already taken.` };
  }

  return {};
}

/**
 * Create a blank product with a default variant.
 *
 * @returns {Promise<{ id: string, defaultVariantId: string }>}
 */
export async function createBlankProduct() {
  const product = await prisma.product.create({
    data: {
      variants: {
        create: [{ inventoryCount: 0, inventoryTracked: true, position: 0 }],
      },
    },
    include: {
      variants: { orderBy: { position: 'asc' }, take: 1 },
    },
  });

  return {
    id: product.id,
    defaultVariantId: product.variants[0].id,
  };
}
