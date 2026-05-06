// app/routes/admin/products/$id.jsx
// Full product editor — locale tabs, options + variants, per-currency price
// grid, media uploader, category picker, SEO, publish toggle.

import {
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { redirect } from 'react-router';
import clsx from 'clsx';

import prisma from '#/libs/prisma.server';
import { get } from '#/core/settings/index.server';
import { uploadMedia } from '#/core/storage/index.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [product, localesRaw, currenciesRaw] = await Promise.all([
    prisma.product.findUniqueOrThrow({
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
    }),
    get('locales'),
    get('currencies'),
  ]);

  const locales = Array.isArray(localesRaw) ? localesRaw : ['en'];
  const currencies = Array.isArray(currenciesRaw) ? currenciesRaw : ['USD'];

  // Translations
  const translations = await prisma.translation.findMany({
    where: { entityType: 'product', entityId: id },
  });
  const translationMap = {};
  for (const t of translations) {
    if (!translationMap[t.locale]) translationMap[t.locale] = {};
    translationMap[t.locale][t.field] = t.value;
  }

  // Slugs
  const slugRows = await prisma.slug.findMany({
    where: { entityType: 'product', entityId: id },
  });
  const slugMap = Object.fromEntries(slugRows.map((s) => [s.locale, s.slug]));

  // Categories (all, with en titles)
  const allCategories = await prisma.category.findMany({
    orderBy: { position: 'asc' },
  });
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
    product: {
      id: product.id,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku ?? '',
        inventoryCount: v.inventoryCount,
        inventoryTracked: v.inventoryTracked,
        position: v.position,
        prices: Object.fromEntries(
          v.prices.map((p) => [
            p.currency,
            {
              priceCents: p.priceCents,
              comparePriceCents: p.comparePriceCents ?? '',
            },
          ])
        ),
      })),
      options: product.options.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        values: o.values.map((v) => ({ id: v.id, value: v.value })),
      })),
      selectedCategoryIds: product.categories.map((c) => c.categoryId),
      media: product.media.map((pm) => ({
        productMediaId: pm.id,
        mediaId: pm.mediaId,
        url: pm.media.url,
        altText: pm.media.altText ?? '',
        position: pm.position,
      })),
    },
    locales,
    currencies,
    translationMap,
    slugMap,
    allCategories: allCategories.map((c) => ({
      id: c.id,
      title: catTitleMap[c.id] ?? `(${c.id.slice(0, 6)})`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }) {
  const { id } = params;

  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Upload media ──────────────────────────────────────────────────────────
  if (intent === 'upload-media') {
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return { ok: false, error: 'No file provided.' };
    }

    const { url, storageKey, mimeType, width, height } =
      await uploadMedia(file);

    const media = await prisma.media.create({
      data: { storageKey, url, mimeType, width, height },
    });

    const lastMedia = await prisma.productMedia.findFirst({
      where: { productId: id },
      orderBy: { position: 'desc' },
    });

    await prisma.productMedia.create({
      data: {
        productId: id,
        mediaId: media.id,
        position: (lastMedia?.position ?? -1) + 1,
      },
    });

    return { ok: true, intent: 'upload-media' };
  }

  // ── Delete media ──────────────────────────────────────────────────────────
  if (intent === 'delete-media') {
    const mediaId = formData.get('mediaId');
    await prisma.productMedia.deleteMany({
      where: { productId: id, mediaId },
    });
    return { ok: true, intent: 'delete-media' };
  }

  // ── Save product ──────────────────────────────────────────────────────────
  if (intent === 'save') {
    const locales = formData.getAll('locales[]');
    const currencies = formData.getAll('currencies[]');

    // Publish toggle
    const publish = formData.get('publishedAt');
    if (publish === 'publish') {
      await prisma.product.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
    } else if (publish === 'unpublish') {
      await prisma.product.update({
        where: { id },
        data: { publishedAt: null },
      });
    }

    // Translations + slugs per locale
    for (const locale of locales) {
      const fields = ['title', 'description', 'seoTitle', 'seoDescription'];
      for (const field of fields) {
        const value = formData.get(`translation[${locale}][${field}]`) ?? '';
        await prisma.translation.upsert({
          where: {
            entityType_entityId_locale_field: {
              entityType: 'product',
              entityId: id,
              locale,
              field,
            },
          },
          update: { value },
          create: { entityType: 'product', entityId: id, locale, field, value },
        });
      }

      const slugValue = formData
        .get(`slug[${locale}]`)
        ?.toString()
        .trim();
      if (slugValue) {
        try {
          await prisma.slug.upsert({
            where: {
              entityType_entityId_locale: {
                entityType: 'product',
                entityId: id,
                locale,
              },
            },
            update: { slug: slugValue },
            create: {
              entityType: 'product',
              entityId: id,
              locale,
              slug: slugValue,
            },
          });
        } catch {
          // Slug collision — skip silently (unique constraint)
        }
      }
    }

    // Categories
    const selectedCatIds = formData.getAll('categoryIds[]');
    // Delete categories not in the new set
    await prisma.productCategory.deleteMany({
      where: {
        productId: id,
        categoryId: { notIn: selectedCatIds },
      },
    });
    // Upsert selected categories
    for (let i = 0; i < selectedCatIds.length; i++) {
      await prisma.productCategory.upsert({
        where: {
          productId_categoryId: {
            productId: id,
            categoryId: selectedCatIds[i],
          },
        },
        update: { position: i },
        create: { productId: id, categoryId: selectedCatIds[i], position: i },
      });
    }

    // Options + values
    const optionIdsRaw = formData.getAll('optionIds[]');
    const existingOptionIds = optionIdsRaw.filter((x) => !x.startsWith('new-'));
    const newOptionNames = optionIdsRaw
      .filter((x) => x.startsWith('new-'))
      .map((_, i) => {
        // new option ids are "new-{index}" — get the name via the name field
        return null;
      });

    // Collect all option ids submitted
    const submittedOptionKeys = [...formData.keys()].filter((k) =>
      k.startsWith('option[')
    );

    // Process options from structured form fields: option[{id}][name]
    const optionDataMap = {};
    for (const key of submittedOptionKeys) {
      const match = key.match(/^option\[([^\]]+)\]\[([^\]]+)\]$/);
      if (!match) continue;
      const [, optId, field] = match;
      if (!optionDataMap[optId]) optionDataMap[optId] = { values: [] };
      optionDataMap[optId][field] = formData.get(key);
    }

    // Collect option values
    const optionValueKeys = [...formData.keys()].filter((k) =>
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
      optionDataMap[optId].values[idx].value = formData.get(key);
    }

    const optionValueIdKeys = [...formData.keys()].filter((k) =>
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
      optionDataMap[optId].values[idx].id = formData.get(key);
    }

    // Delete options that are no longer present
    const submittedOptionIds = Object.keys(optionDataMap);
    const persistedOptionIds = submittedOptionIds.filter(
      (x) => !x.startsWith('new-')
    );
    await prisma.productOption.deleteMany({
      where: {
        productId: id,
        id: { notIn: persistedOptionIds },
      },
    });

    // Upsert options + values
    for (const [optId, optData] of Object.entries(optionDataMap)) {
      const name = optData.name ?? '';
      let dbOptionId;

      if (optId.startsWith('new-')) {
        const created = await prisma.productOption.create({
          data: { productId: id, name, position: 0 },
        });
        dbOptionId = created.id;
      } else {
        await prisma.productOption.update({
          where: { id: optId },
          data: { name },
        });
        dbOptionId = optId;
      }

      // Collect current DB value ids for this option
      const currentValues = await prisma.productOptionValue.findMany({
        where: { optionId: dbOptionId },
      });

      const submittedValueIds = (optData.values ?? [])
        .map((v) => v?.id)
        .filter((v) => v && !v.startsWith('new-'));

      // Delete removed values
      await prisma.productOptionValue.deleteMany({
        where: {
          optionId: dbOptionId,
          id: { notIn: submittedValueIds },
        },
      });

      // Upsert values
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

    // Variants
    const variantKeys = [...formData.keys()].filter((k) =>
      k.startsWith('variant[')
    );
    const variantDataMap = {};
    for (const key of variantKeys) {
      const match = key.match(/^variant\[([^\]]+)\]\[([^\]]+)\]$/);
      if (!match) continue;
      const [, varId, field] = match;
      if (!variantDataMap[varId]) variantDataMap[varId] = {};
      variantDataMap[varId][field] = formData.get(key);
    }

    // Price keys: price[{variantId}][{currency}] and comparePrice[{variantId}][{currency}]
    const priceKeys = [...formData.keys()].filter((k) =>
      k.startsWith('price[')
    );
    const comparePriceKeys = [...formData.keys()].filter((k) =>
      k.startsWith('comparePrice[')
    );

    const priceDataMap = {}; // variantId -> currency -> { priceCents, comparePriceCents }
    for (const key of priceKeys) {
      const match = key.match(/^price\[([^\]]+)\]\[([^\]]+)\]$/);
      if (!match) continue;
      const [, varId, currency] = match;
      if (!priceDataMap[varId]) priceDataMap[varId] = {};
      if (!priceDataMap[varId][currency]) priceDataMap[varId][currency] = {};
      const raw = formData.get(key) ?? '';
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
      const raw = formData.get(key) ?? '';
      const dollars = parseFloat(raw);
      priceDataMap[varId][currency].comparePriceCents = isNaN(dollars)
        ? null
        : Math.round(dollars * 100);
    }

    // Persist variants
    for (const [varId, varData] of Object.entries(variantDataMap)) {
      const sku = varData.sku ?? null;
      const inventoryCount = parseInt(varData.inventoryCount ?? '0', 10);

      await prisma.productVariant.update({
        where: { id: varId },
        data: { sku: sku || null, inventoryCount },
      });

      // Prices for this variant
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

    return { ok: true, intent: 'save' };
  }

  // ── Delete product ────────────────────────────────────────────────────────
  if (intent === 'delete') {
    await prisma.product.delete({ where: { id } });
    return redirect('/admin/products');
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Tab bar for switching locales */
function LocaleTabs({ locales, activeLocale, onSelect }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-700">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onSelect(locale)}
          className={clsx(
            'rounded-t px-4 py-2 text-sm font-medium transition-colors',
            activeLocale === locale
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Per-locale translation fields (title, description, seo) */
function LocaleEditor({ locale, translations, slugMap }) {
  const t = translations[locale] ?? {};
  const slug = slugMap[locale] ?? '';

  return (
    <div className="space-y-4 pt-4">
      {/* Hidden locale marker */}
      <input type="hidden" name="locales[]" value={locale} />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
          Slug ({locale})
        </label>
        <input
          type="text"
          name={`slug[${locale}]`}
          defaultValue={slug}
          placeholder="url-slug"
          className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
          Title
        </label>
        <input
          type="text"
          name={`translation[${locale}][title]`}
          defaultValue={t.title ?? ''}
          className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          name={`translation[${locale}][description]`}
          defaultValue={t.description ?? ''}
          rows={4}
          className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
        />
      </div>

      <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-800/50">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          SEO
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              SEO Title
            </label>
            <input
              type="text"
              name={`translation[${locale}][seoTitle]`}
              defaultValue={t.seoTitle ?? ''}
              className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              SEO Description
            </label>
            <textarea
              name={`translation[${locale}][seoDescription]`}
              defaultValue={t.seoDescription ?? ''}
              rows={2}
              className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Options editor: add/remove options and their values */
function OptionsEditor({ initialOptions }) {
  const [options, setOptions] = useState(initialOptions);

  function addOption() {
    setOptions((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: '',
        position: prev.length,
        values: [],
      },
    ]);
  }

  function removeOption(optId) {
    setOptions((prev) => prev.filter((o) => o.id !== optId));
  }

  function updateOptionName(optId, name) {
    setOptions((prev) =>
      prev.map((o) => (o.id === optId ? { ...o, name } : o))
    );
  }

  function addValue(optId) {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optId
          ? {
              ...o,
              values: [
                ...o.values,
                { id: `new-${Date.now()}`, value: '' },
              ],
            }
          : o
      )
    );
  }

  function removeValue(optId, valId) {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optId
          ? { ...o, values: o.values.filter((v) => v.id !== valId) }
          : o
      )
    );
  }

  function updateValue(optId, valId, value) {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optId
          ? {
              ...o,
              values: o.values.map((v) =>
                v.id === valId ? { ...v, value } : v
              ),
            }
          : o
      )
    );
  }

  return (
    <div className="space-y-4">
      {options.map((opt) => (
        <div
          key={opt.id}
          className="rounded-lg border border-gray-200 p-4 dark:border-zinc-700"
        >
          <input type="hidden" name={`option[${opt.id}][id]`} value={opt.id} />
          <div className="flex items-center gap-3">
            <input
              type="text"
              name={`option[${opt.id}][name]`}
              value={opt.name}
              onChange={(e) => updateOptionName(opt.id, e.target.value)}
              placeholder="Option name (e.g. Size)"
              className="flex-1 rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
            />
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              className="rounded p-1 text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {opt.values.map((val, vi) => (
              <div key={val.id} className="flex items-center gap-2">
                <input
                  type="hidden"
                  name={`optionValueId[${opt.id}][${vi}]`}
                  value={val.id}
                />
                <input
                  type="text"
                  name={`optionValue[${opt.id}][${vi}]`}
                  value={val.value}
                  onChange={(e) => updateValue(opt.id, val.id, e.target.value)}
                  placeholder="Value"
                  className="flex-1 rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => removeValue(opt.id, val.id)}
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addValue(opt.id)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <PlusIcon className="h-3 w-3" />
              Add value
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        <PlusIcon className="h-4 w-4" />
        Add option
      </button>
    </div>
  );
}

/** Per-currency price grid for all variants */
function VariantPriceGrid({ variants, currencies }) {
  function centsToDisplay(cents) {
    if (cents === '' || cents === null || cents === undefined) return '';
    return (Number(cents) / 100).toFixed(2);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-zinc-700">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-800">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              SKU
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Inventory
            </th>
            {currencies.map((cur) => (
              <th
                key={cur}
                colSpan={2}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400"
              >
                {cur}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 dark:bg-zinc-800">
            <th />
            <th />
            {currencies.map((cur) => (
              <>
                <th
                  key={`${cur}-price`}
                  className="px-3 py-1 text-left text-xs text-gray-400 dark:text-zinc-500"
                >
                  Price
                </th>
                <th
                  key={`${cur}-compare`}
                  className="px-3 py-1 text-left text-xs text-gray-400 dark:text-zinc-500"
                >
                  Compare
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
          {variants.map((variant) => (
            <tr key={variant.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
              <td className="px-3 py-2">
                <input
                  type="text"
                  name={`variant[${variant.id}][sku]`}
                  defaultValue={variant.sku}
                  placeholder="SKU"
                  className="w-24 rounded border-0 bg-white px-2 py-1 text-sm shadow-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  name={`variant[${variant.id}][inventoryCount]`}
                  defaultValue={variant.inventoryCount}
                  min={0}
                  className="w-16 rounded border-0 bg-white px-2 py-1 text-sm shadow-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                />
              </td>
              {currencies.map((cur) => {
                const priceData = variant.prices[cur];
                return (
                  <>
                    <td key={`${variant.id}-${cur}-price`} className="px-3 py-2">
                      <input
                        type="number"
                        name={`price[${variant.id}][${cur}]`}
                        defaultValue={
                          priceData
                            ? centsToDisplay(priceData.priceCents)
                            : ''
                        }
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        className="w-24 rounded border-0 bg-white px-2 py-1 text-sm shadow-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                      />
                    </td>
                    <td key={`${variant.id}-${cur}-compare`} className="px-3 py-2">
                      <input
                        type="number"
                        name={`comparePrice[${variant.id}][${cur}]`}
                        defaultValue={
                          priceData?.comparePriceCents
                            ? centsToDisplay(priceData.comparePriceCents)
                            : ''
                        }
                        min={0}
                        step="0.01"
                        placeholder="—"
                        className="w-24 rounded border-0 bg-white px-2 py-1 text-sm shadow-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                      />
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {variants.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">
          No variants yet.
        </p>
      )}
    </div>
  );
}

/** Media uploader + grid */
function MediaUploader({ productId, initialMedia }) {
  const fetcher = useFetcher();
  const fileRef = useRef(null);
  const [media, setMedia] = useState(initialMedia);

  // Update local state when fetcher returns after upload or delete
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      if (
        fetcher.data.intent === 'upload-media' ||
        fetcher.data.intent === 'delete-media'
      ) {
        // Reload media from the server — trigger a page re-fetch via a
        // no-op navigation trick: just let the parent loader re-run.
        window.location.reload();
      }
    }
  }, [fetcher.state, fetcher.data]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('intent', 'upload-media');
    fd.append('file', file);
    fetcher.submit(fd, { method: 'post', encType: 'multipart/form-data' });
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDelete(mediaId) {
    const fd = new FormData();
    fd.append('intent', 'delete-media');
    fd.append('mediaId', mediaId);
    fetcher.submit(fd, { method: 'post' });
  }

  const isUploading =
    fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'upload-media';

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {media.map((item) => (
          <div
            key={item.mediaId}
            className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <img
              src={item.url}
              alt={item.altText || ''}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleDelete(item.mediaId)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <TrashIcon className="h-5 w-5 text-white" />
            </button>
          </div>
        ))}

        {/* Upload button */}
        <label
          className={clsx(
            'flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-indigo-400 hover:text-indigo-400 dark:border-zinc-600 dark:hover:border-indigo-500',
            isUploading && 'cursor-wait opacity-60'
          )}
        >
          {isUploading ? (
            <span className="text-xs">Uploading…</span>
          ) : (
            <>
              <PhotoIcon className="h-6 w-6" />
              <span className="mt-1 text-xs">Add image</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
}

/** Category picker — multi-select checkboxes */
function CategoryPicker({ allCategories, selectedIds }) {
  const [selected, setSelected] = useState(new Set(selectedIds));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="max-h-48 space-y-2 overflow-y-auto">
      {allCategories.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-zinc-500">
          No categories yet.
        </p>
      )}
      {allCategories.map((cat) => {
        const checked = selected.has(cat.id);
        return (
          <label key={cat.id} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="categoryIds[]"
              value={cat.id}
              checked={checked}
              onChange={() => toggle(cat.id)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <span className="text-sm text-gray-700 dark:text-zinc-300">
              {cat.title}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminProductRoute() {
  const { product, locales, currencies, translationMap, slugMap, allCategories } =
    useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'save';

  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  const isPublished = product.publishedAt !== null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
            <a
              href="/admin/products"
              className="hover:underline"
            >
              Products
            </a>
            <span>/</span>
            <span className="font-mono text-xs">{product.id.slice(0, 8)}…</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Product
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">
            Created{' '}
            {new Date(product.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Publish toggle */}
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              isPublished
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400'
            )}
          >
            {isPublished ? 'Published' : 'Draft'}
          </span>
          <Form method="post">
            <input type="hidden" name="intent" value="save" />
            <input
              type="hidden"
              name="publishedAt"
              value={isPublished ? 'unpublish' : 'publish'}
            />
            {/* We need currencies/locales in the form even for publish toggle */}
            {locales.map((l) => (
              <input key={l} type="hidden" name="locales[]" value={l} />
            ))}
            <button
              type="submit"
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                isPublished
                  ? 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 focus-visible:outline-gray-500 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600'
                  : 'bg-green-600 text-white hover:bg-green-500 focus-visible:outline-green-600'
              )}
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </Form>
        </div>
      </div>

      {/* Notification */}
      {actionData?.ok && actionData?.intent === 'save' && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Product saved.
        </div>
      )}
      {actionData?.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {actionData.error}
        </div>
      )}

      {/* Main save form */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save" />

        {/* Locale tabs */}
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Content
          </h2>
          <LocaleTabs
            locales={locales}
            activeLocale={activeLocale}
            onSelect={setActiveLocale}
          />
          {locales.map((locale) => (
            <div
              key={locale}
              className={locale === activeLocale ? 'block' : 'hidden'}
            >
              <LocaleEditor
                locale={locale}
                translations={translationMap}
                slugMap={slugMap}
              />
            </div>
          ))}
        </div>

        {/* Options editor */}
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Options
          </h2>
          <OptionsEditor initialOptions={product.options} />
        </div>

        {/* Variants + price grid */}
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Variants &amp; Pricing
          </h2>
          {/* Hidden currencies markers */}
          {currencies.map((c) => (
            <input key={c} type="hidden" name="currencies[]" value={c} />
          ))}
          <VariantPriceGrid variants={product.variants} currencies={currencies} />
        </div>

        {/* Category picker */}
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Categories
          </h2>
          <CategoryPicker
            allCategories={allCategories}
            selectedIds={product.selectedCategoryIds}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save Product'}
          </button>

          {/* Delete */}
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              onClick={(e) => {
                if (
                  !window.confirm(
                    'Delete this product? This cannot be undone.'
                  )
                ) {
                  e.preventDefault();
                }
              }}
              className="text-sm text-red-600 hover:underline dark:text-red-400"
            >
              Delete product
            </button>
          </Form>
        </div>
      </Form>

      {/* Media uploader (separate fetcher — not inside main form) */}
      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          Media
        </h2>
        <MediaUploader productId={product.id} initialMedia={product.media} />
      </div>
    </div>
  );
}
