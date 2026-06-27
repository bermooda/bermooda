import {
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Form, Link, useFetcher, useRevalidator } from 'react-router';

import { slugify } from '#/utils/slugify';
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

const NEW_VARIANT_ID = 'new-variant-0';

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

/**
 * Per-locale translation fields. Auto-generates slug from title on the primary
 * locale until the slug field is edited manually.
 */
function LocaleEditor({
  locale,
  translations,
  slugMap,
  primaryLocale,
  isActive,
}) {
  const t = translations[locale] ?? {};
  const initialSlug = slugMap[locale] ?? '';
  const initialTitle = t.title ?? '';

  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [slugManual, setSlugManual] = useState(Boolean(initialSlug));

  useEffect(() => {
    if (!isActive) return;
    setTitle(initialTitle);
    setSlug(initialSlug);
    setSlugManual(Boolean(initialSlug));
  }, [initialTitle, initialSlug, isActive]);

  function handleTitleChange(event) {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    if (locale === primaryLocale && !slugManual) {
      setSlug(slugify(nextTitle));
    }
  }

  function handleSlugChange(event) {
    setSlugManual(true);
    setSlug(event.target.value);
  }

  return (
    <div className="space-y-5 pt-5">
      <input type="hidden" name="locales[]" value={locale} />

      <Field label="Title" htmlFor={`title-${locale}`}>
        <Input
          id={`title-${locale}`}
          name={`translation[${locale}][title]`}
          value={title}
          onChange={handleTitleChange}
          autoFocus={locale === primaryLocale}
        />
      </Field>

      <Field
        label={`URL slug (${locale})`}
        htmlFor={`slug-${locale}`}
        hint={
          locale === primaryLocale
            ? 'Generated from the title as you type. You can edit it anytime.'
            : undefined
        }
      >
        <div className="relative">
          <span className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            /
          </span>
          <Input
            id={`slug-${locale}`}
            name={`slug[${locale}]`}
            value={slug}
            onChange={handleSlugChange}
            placeholder="url-slug"
            className="pl-7"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </div>
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
                <Fragment key={cur}>
                  <th className="text-text-muted px-3 py-2 text-left text-xs font-medium">
                    Price
                  </th>
                  <th className="text-text-muted px-3 py-2 text-left text-xs font-medium">
                    Compare
                  </th>
                </Fragment>
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
                    <Fragment key={cur}>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
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
                    </Fragment>
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
function MediaUploader({ initialMedia, disabled = false, disabledMessage }) {
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const fileRef = useRef(null);
  const [media] = useState(initialMedia);

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

  if (disabled) {
    return (
      <div className="border-border text-text-muted rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        {disabledMessage}
      </div>
    );
  }

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

/**
 * Shared admin product editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} props.mode
 * @param {Object} props.product
 * @param {string[]} props.locales
 * @param {string[]} props.currencies
 * @param {Record<string, Record<string, string>>} props.translationMap
 * @param {Record<string, string>} props.slugMap
 * @param {{ id: string, title: string }[]} props.allCategories
 * @param {Object} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ProductEditor({
  mode,
  product,
  locales,
  currencies,
  translationMap,
  slugMap,
  allCategories,
  actionData,
  isSaving,
}) {
  const primaryLocale = locales[0] ?? 'en';
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const isCreate = mode === 'create';
  const isPublished = product.publishedAt !== null;

  const displayTitle = isCreate
    ? 'New product'
    : translationMap[primaryLocale]?.title ||
      slugMap[primaryLocale] ||
      `Product ${product.id.slice(0, 8)}`;

  const subtitle = isCreate
    ? 'Add product details, pricing, and categories. Images can be uploaded after saving.'
    : `Created ${new Date(product.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}`;

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
        subtitle={subtitle}
        actions={
          !isCreate && (
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
          )
        }
      />

      {actionData?.ok && actionData?.intent === 'save' && (
        <SuccessAlert message="Product saved." />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" className="space-y-6">
        <input
          type="hidden"
          name="intent"
          value={isCreate ? 'create' : 'save'}
        />

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
                    primaryLocale={primaryLocale}
                    isActive={locale === activeLocale}
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
                initialMedia={product.media}
                disabled={isCreate}
                disabledMessage="Save the product first to upload images."
              />
            </Card>
          </aside>
        </div>

        <ActionBar>
          <div className="flex items-center gap-3">
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? isCreate
                  ? 'Creating…'
                  : 'Saving…'
                : isCreate
                  ? 'Create product'
                  : 'Save product'}
            </ButtonSubmit>
            <Link
              to="/admin/products"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
          </div>
          {!isCreate && (
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
                className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
              >
                Delete product
              </button>
            </Form>
          )}
        </ActionBar>
      </Form>
    </div>
  );
}

export { NEW_VARIANT_ID };
