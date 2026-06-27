// app/routes/admin/products/$id.jsx
// Full product editor — locale tabs, options + variants, per-currency price
// grid, media uploader, category picker, SEO, publish toggle.

import {
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { Th } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

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

      const slugValue = formData.get(`slug[${locale}]`)?.toString().trim();
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
  const activeIndex = Math.max(0, locales.indexOf(activeLocale));

  return (
    <Tabs
      tabs={locales.map((locale) => locale.toUpperCase())}
      active={activeIndex}
      onChange={(index) => onSelect(locales[index])}
      variant="pills"
    />
  );
}

/** Per-locale translation fields (title, description, seo) */
function LocaleEditor({ locale, translations, slugMap }) {
  const t = translations[locale] ?? {};
  const slug = slugMap[locale] ?? '';

  return (
    <div className="space-y-5 pt-5">
      <input type="hidden" name="locales[]" value={locale} />

      <Field label={`Slug (${locale})`} htmlFor={`slug-${locale}`}>
        <Input
          id={`slug-${locale}`}
          name={`slug[${locale}]`}
          defaultValue={slug}
          placeholder="url-slug"
        />
      </Field>

      <Field label="Title" htmlFor={`title-${locale}`}>
        <Input
          id={`title-${locale}`}
          name={`translation[${locale}][title]`}
          defaultValue={t.title ?? ''}
        />
      </Field>

      <Field label="Description" htmlFor={`description-${locale}`}>
        <Textarea
          id={`description-${locale}`}
          name={`translation[${locale}][description]`}
          defaultValue={t.description ?? ''}
          rows={4}
        />
      </Field>

      <div className="bg-surface-2/70 border-border rounded-lg border p-4">
        <p className="text-text-muted mb-4 text-xs font-semibold tracking-wide uppercase">
          SEO
        </p>
        <div className="space-y-4">
          <Field label="SEO title" htmlFor={`seo-title-${locale}`}>
            <Input
              id={`seo-title-${locale}`}
              name={`translation[${locale}][seoTitle]`}
              defaultValue={t.seoTitle ?? ''}
            />
          </Field>
          <Field label="SEO description" htmlFor={`seo-desc-${locale}`}>
            <Textarea
              id={`seo-desc-${locale}`}
              name={`translation[${locale}][seoDescription]`}
              defaultValue={t.seoDescription ?? ''}
              rows={2}
            />
          </Field>
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
              values: [...o.values, { id: `new-${Date.now()}`, value: '' }],
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
    <div className="space-y-3">
      {options.map((opt) => (
        <div
          key={opt.id}
          className="bg-surface-2/50 border-border rounded-lg border p-4"
        >
          <input type="hidden" name={`option[${opt.id}][id]`} value={opt.id} />
          <div className="flex items-center gap-3">
            <Input
              name={`option[${opt.id}][name]`}
              value={opt.name}
              onChange={(e) => updateOptionName(opt.id, e.target.value)}
              placeholder="Option name (e.g. Size)"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              className="text-text-muted hover:bg-danger/10 hover:text-danger rounded-md p-2 transition-colors"
              aria-label="Remove option"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {opt.values.map((val, vi) => (
              <div key={val.id} className="flex items-center gap-2">
                <input
                  type="hidden"
                  name={`optionValueId[${opt.id}][${vi}]`}
                  value={val.id}
                />
                <Input
                  name={`optionValue[${opt.id}][${vi}]`}
                  value={val.value}
                  onChange={(e) => updateValue(opt.id, val.id, e.target.value)}
                  placeholder="Value"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeValue(opt.id, val.id)}
                  className="text-text-muted hover:bg-danger/10 hover:text-danger rounded-md p-2 transition-colors"
                  aria-label="Remove value"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addValue(opt.id)}
              className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add value
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addOption}
        className="text-accent hover:text-accent-hover border-border hover:border-accent/40 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-colors"
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
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="divide-border min-w-full divide-y text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <Th>SKU</Th>
              <Th>Inventory</Th>
              {currencies.map((cur) => (
                <Th key={cur} colSpan={2} className="text-center">
                  {cur}
                </Th>
              ))}
            </tr>
            <tr className="bg-surface-2/40">
              <th />
              <th />
              {currencies.map((cur) => (
                <>
                  <th
                    key={`${cur}-price`}
                    className="text-text-muted px-3 py-2 text-left text-xs font-medium"
                  >
                    Price
                  </th>
                  <th
                    key={`${cur}-compare`}
                    className="text-text-muted px-3 py-2 text-left text-xs font-medium"
                  >
                    Compare
                  </th>
                </>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border bg-surface [&>tr:hover]:bg-surface-2/40 divide-y">
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td className="px-3 py-3">
                  <Input
                    name={`variant[${variant.id}][sku]`}
                    defaultValue={variant.sku}
                    placeholder="SKU"
                    className="w-28"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    type="number"
                    name={`variant[${variant.id}][inventoryCount]`}
                    defaultValue={variant.inventoryCount}
                    min={0}
                    className="w-20"
                  />
                </td>
                {currencies.map((cur) => {
                  const priceData = variant.prices[cur];
                  return (
                    <>
                      <td
                        key={`${variant.id}-${cur}-price`}
                        className="px-3 py-3"
                      >
                        <Input
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
                          className="w-24"
                        />
                      </td>
                      <td
                        key={`${variant.id}-${cur}-compare`}
                        className="px-3 py-3"
                      >
                        <Input
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
                          className="w-24"
                        />
                      </td>
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {variants.length === 0 && (
        <p className="text-text-muted py-8 text-center text-sm">
          No variants yet.
        </p>
      )}
    </div>
  );
}

/** Media uploader + grid */
function MediaUploader({ productId: _productId, initialMedia }) {
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const fileRef = useRef(null);
  const [media] = useState(initialMedia);

  // After a media upload or delete completes, revalidate loader data to
  // refresh the media list without unmounting the form or resetting field values.
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidate]);

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
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'upload-media';

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {media.map((item) => (
          <div
            key={item.mediaId}
            className="group border-border bg-surface-2 relative aspect-square overflow-hidden rounded-lg border"
          >
            <img
              src={item.url}
              alt={item.altText || ''}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleDelete(item.mediaId)}
              className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete image"
            >
              <TrashIcon className="h-5 w-5 text-white" />
            </button>
          </div>
        ))}

        <label
          className={clsx(
            'border-border text-text-muted hover:border-accent hover:bg-accent/5 hover:text-accent flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
            isUploading && 'cursor-wait opacity-60'
          )}
        >
          {isUploading ? (
            <span className="text-xs">Uploading…</span>
          ) : (
            <>
              <PhotoIcon className="h-6 w-6" />
              <span className="mt-2 text-xs font-medium">Add image</span>
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
    <div className="border-border max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
      {allCategories.length === 0 && (
        <p className="text-text-muted px-2 py-3 text-sm">No categories yet.</p>
      )}
      {allCategories.map((cat) => {
        const checked = selected.has(cat.id);
        return (
          <label
            key={cat.id}
            className={clsx(
              'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors',
              checked ? 'bg-accent/10' : 'hover:bg-surface-2'
            )}
          >
            <input
              type="checkbox"
              name="categoryIds[]"
              value={cat.id}
              checked={checked}
              onChange={() => toggle(cat.id)}
              className="border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded"
            />
            <span className="text-text text-sm">{cat.title}</span>
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
  const {
    product,
    locales,
    currencies,
    translationMap,
    slugMap,
    allCategories,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'save';

  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  const isPublished = product.publishedAt !== null;
  const displayTitle =
    translationMap.en?.title ||
    slugMap.en ||
    `Product ${product.id.slice(0, 8)}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Products', href: '/admin/products' },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={`Created ${new Date(product.createdAt).toLocaleDateString(
          'en-US',
          {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }
        )}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={isPublished ? 'success' : 'neutral'}>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
            <Form method="post">
              <input type="hidden" name="intent" value="save" />
              <input
                type="hidden"
                name="publishedAt"
                value={isPublished ? 'unpublish' : 'publish'}
              />
              {locales.map((l) => (
                <input key={l} type="hidden" name="locales[]" value={l} />
              ))}
              <Button
                type="submit"
                variant={isPublished ? 'secondary' : 'primary'}
              >
                {isPublished ? 'Unpublish' : 'Publish'}
              </Button>
            </Form>
          </div>
        }
      />

      {actionData?.ok && actionData?.intent === 'save' && (
        <SuccessAlert message="Product saved." />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Content"
                description="Localized titles, descriptions, and SEO metadata."
              />
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
            </Card>

            <Card>
              <CardHeader
                title="Options"
                description="Define option groups like size or color for variant generation."
              />
              <OptionsEditor initialOptions={product.options} />
            </Card>

            <Card>
              <CardHeader
                title="Variants & pricing"
                description="SKU, inventory, and per-currency prices for each variant."
              />
              {currencies.map((c) => (
                <input key={c} type="hidden" name="currencies[]" value={c} />
              ))}
              <VariantPriceGrid
                variants={product.variants}
                currencies={currencies}
              />
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader
                title="Categories"
                description="Assign this product to one or more categories."
              />
              <CategoryPicker
                allCategories={allCategories}
                selectedIds={product.selectedCategoryIds}
              />
            </Card>

            <Card>
              <CardHeader
                title="Media"
                description="Product images shown on the storefront."
              />
              <MediaUploader
                productId={product.id}
                initialMedia={product.media}
              />
            </Card>
          </aside>
        </div>

        <ActionBar>
          <div className="flex items-center gap-3">
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save product'}
            </ButtonSubmit>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              onClick={(e) => {
                if (
                  !window.confirm('Delete this product? This cannot be undone.')
                ) {
                  e.preventDefault();
                }
              }}
              className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
            >
              Delete product
            </button>
          </Form>
        </ActionBar>
      </Form>
    </div>
  );
}
