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
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Textarea from '#/components/admin/form/textarea';
import LocaleTabs from '#/components/admin/locale-tabs';
import PageHeader from '#/components/admin/page-header';
import SeoFields from '#/components/admin/seo-fields';
import SlugField from '#/components/admin/slug-field';
import { Th } from '#/components/admin/table';
import SlotBlocks from '#/components/slot-blocks';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

/**
 * Two-column form section (Tailwind UI form-layouts pattern).
 * Left: title + description; right: fields spanning two columns on `md+`.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.last=false] Omit bottom border on the final section
 * @returns {React.ReactElement}
 */
function FormSection({ title, description, children, last = false }) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3',
        !last && 'border-border border-b pb-12'
      )}
    >
      <div>
        <h2 className="text-text text-base/7 font-semibold">{title}</h2>
        {description ? (
          <p className="text-text-muted mt-1 text-sm/6">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 md:col-span-2">{children}</div>
    </div>
  );
}

/**
 * Per-locale translation fields. Auto-generates slug from title on the primary
 * locale until the slug field is edited manually.
 *
 * @param {Object} props
 * @param {string} props.locale
 * @param {Record<string, Record<string, string>>} props.translations
 * @param {Record<string, string>} props.slugMap
 * @param {string} props.primaryLocale
 * @param {boolean} props.isActive
 * @returns {React.ReactElement}
 */
function LocaleEditor({
  locale,
  translations,
  slugMap,
  primaryLocale,
  isActive,
}) {
  const t = useT();
  const localeFields = translations[locale] ?? {};
  const initialSlug = slugMap[locale] ?? '';
  const initialTitle = localeFields.title ?? '';

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
    <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 pt-6 sm:grid-cols-6">
      <input type="hidden" name="locales[]" value={locale} />

      <Field
        className="sm:col-span-4"
        label={t('admin.products.editor.titleLabel')}
        htmlFor={`title-${locale}`}
      >
        <Input
          id={`title-${locale}`}
          name={`translation[${locale}][title]`}
          value={title}
          onChange={handleTitleChange}
          autoFocus={locale === primaryLocale}
        />
      </Field>

      <div className="sm:col-span-4">
        <SlugField
          id={`slug-${locale}`}
          name={`slug[${locale}]`}
          label={t('admin.products.editor.slugLabel', { locale })}
          hint={
            locale === primaryLocale
              ? t('admin.products.editor.slugHint')
              : undefined
          }
          value={slug}
          onChange={handleSlugChange}
          placeholder={t('admin.products.editor.slugPlaceholder')}
        />
      </div>

      <Field
        className="col-span-full"
        label={t('admin.products.editor.descriptionLabel')}
        htmlFor={`description-${locale}`}
      >
        <Textarea
          id={`description-${locale}`}
          name={`translation[${locale}][description]`}
          defaultValue={localeFields.description ?? ''}
          rows={4}
        />
      </Field>

      <div className="col-span-full">
        <SeoFields
          titleFieldName={`translation[${locale}][seoTitle]`}
          descriptionFieldName={`translation[${locale}][seoDescription]`}
          titleId={`seo-title-${locale}`}
          descriptionId={`seo-desc-${locale}`}
          defaultTitle={localeFields.seoTitle ?? ''}
          defaultDescription={localeFields.seoDescription ?? ''}
        />
      </div>
    </div>
  );
}

/**
 * Options editor: add/remove options and their values.
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string, position: number, values: Array<{ id: string, value: string }> }>} props.initialOptions
 * @returns {React.ReactElement}
 */
function OptionsEditor({ initialOptions }) {
  const t = useT();
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
              placeholder={t('admin.products.editor.optionNamePlaceholder')}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              className="text-text-muted hover:bg-danger/10 hover:text-danger rounded-md p-2 transition-colors"
              aria-label={t('admin.products.editor.removeOption')}
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
                  placeholder={t('admin.products.editor.valuePlaceholder')}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeValue(opt.id, val.id)}
                  className="text-text-muted hover:bg-danger/10 hover:text-danger rounded-md p-2 transition-colors"
                  aria-label={t('admin.products.editor.removeValue')}
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
              {t('admin.products.editor.addValue')}
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
        {t('admin.products.editor.addOption')}
      </button>
    </div>
  );
}

/**
 * Per-currency price grid for all variants.
 *
 * @param {Object} props
 * @param {Array<{ id: string, sku: string, inventoryCount: number, prices: Record<string, { priceCents?: number, comparePriceCents?: number }> }>} props.variants
 * @param {string[]} props.currencies
 * @returns {React.ReactElement}
 */
function VariantPriceGrid({ variants, currencies }) {
  const t = useT();

  function centsToDisplay(cents) {
    if (cents === '' || cents === null || cents === undefined) return '';
    return (Number(cents) / 100).toFixed(2);
  }

  return (
    <div className="border-border min-w-0 overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="divide-border w-max divide-y text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <Th className="px-3 py-2 whitespace-nowrap">
                {t('admin.products.editor.colSku')}
              </Th>
              <Th className="px-3 py-2 whitespace-nowrap">
                {t('admin.products.editor.colInventory')}
              </Th>
              {currencies.map((cur) => (
                <Fragment key={cur}>
                  <Th className="px-3 py-2 whitespace-nowrap">
                    {t('admin.products.editor.colPrice', { currency: cur })}
                  </Th>
                  <Th className="px-3 py-2 whitespace-nowrap">
                    {t('admin.products.editor.colCompare', { currency: cur })}
                  </Th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border bg-surface [&>tr:hover]:bg-surface-2/40 divide-y">
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Input
                    name={`variant[${variant.id}][sku]`}
                    defaultValue={variant.sku}
                    placeholder={t('admin.products.editor.skuPlaceholder')}
                    className="w-24"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Input
                    type="number"
                    name={`variant[${variant.id}][inventoryCount]`}
                    defaultValue={variant.inventoryCount}
                    min={0}
                    className="w-16"
                  />
                </td>
                {currencies.map((cur) => {
                  const priceData = variant.prices[cur];
                  return (
                    <Fragment key={cur}>
                      <td className="px-3 py-2 whitespace-nowrap">
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
                          className="w-20"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
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
                          className="w-20"
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
          {t('admin.products.editor.noVariants')}
        </p>
      )}
    </div>
  );
}

/**
 * Media uploader + grid.
 *
 * @param {Object} props
 * @param {Array<{ mediaId: string, url: string, altText?: string }>} props.initialMedia
 * @param {boolean} [props.disabled]
 * @param {string} [props.disabledMessage]
 * @returns {React.ReactElement}
 */
function MediaUploader({ initialMedia, disabled = false, disabledMessage }) {
  const t = useT();
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

  const mediaError =
    fetcher.state === 'idle' &&
    fetcher.data?.ok === false &&
    fetcher.data?.intent === 'upload-media'
      ? fetcher.data.error
      : null;

  if (disabled) {
    return (
      <div className="border-border text-text-muted rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        {disabledMessage}
      </div>
    );
  }

  return (
    <div>
      {mediaError && <ErrorAlert message={mediaError} />}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
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
              aria-label={t('admin.products.editor.deleteImage')}
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
            <span className="text-xs">
              {t('admin.products.editor.uploading')}
            </span>
          ) : (
            <>
              <PhotoIcon className="h-6 w-6" />
              <span className="mt-2 text-xs font-medium">
                {t('admin.products.editor.addImage')}
              </span>
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

/**
 * Category picker — multi-select checkboxes.
 *
 * @param {Object} props
 * @param {{ id: string, title: string }[]} props.allCategories
 * @param {string[]} props.selectedIds
 * @returns {React.ReactElement}
 */
function CategoryPicker({ allCategories, selectedIds }) {
  const t = useT();
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
        <p className="text-text-muted px-2 py-3 text-sm">
          {t('admin.products.editor.noCategories')}
        </p>
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
 * @param {Record<string, Array<{ pluginId: string, component: unknown }>>} [props.slotBlocks]
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
  slotBlocks = {},
}) {
  const t = useT();
  const primaryLocale = locales[0] ?? 'en';
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const isCreate = mode === 'create';
  const isPublished = product.publishedAt !== null;

  const displayTitle = isCreate
    ? t('admin.products.index.newButton')
    : translationMap[primaryLocale]?.title ||
      slugMap[primaryLocale] ||
      t('admin.products.editor.fallbackTitle', {
        id: product.id.slice(0, 8),
      });

  const createdDate = new Date(product.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const subtitle = isCreate ? (
    t('admin.products.editor.createSubtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={isPublished ? 'success' : 'neutral'}>
        {isPublished
          ? t('admin.products.status.published')
          : t('admin.products.status.draft')}
      </Badge>
      <span>{t('admin.products.editor.created', { date: createdDate })}</span>
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.products.index.title'),
                href: '/admin/products',
              },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
        actions={
          !isCreate && (
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
                {isPublished
                  ? t('admin.products.editor.unpublish')
                  : t('admin.products.editor.publish')}
              </Button>
            </Form>
          )
        }
      />

      <SlotBlocks
        blocks={slotBlocks['product.editor'] ?? []}
        slotProps={{ product, mode }}
      />

      {actionData?.ok && actionData?.intent === 'save' && (
        <SuccessAlert message={t('admin.products.editor.saved')} />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" id="product-editor-form">
        <input
          type="hidden"
          name="intent"
          value={isCreate ? 'create' : 'save'}
        />

        <div className="space-y-12">
          <FormSection
            title={t('admin.products.editor.contentTitle')}
            description={t('admin.products.editor.contentDescription')}
          >
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
          </FormSection>

          <FormSection
            title={t('admin.products.editor.optionsTitle')}
            description={t('admin.products.editor.optionsDescription')}
          >
            <div className="max-w-2xl">
              <OptionsEditor initialOptions={product.options} />
            </div>
          </FormSection>

          <FormSection
            title={t('admin.products.editor.variantsTitle')}
            description={t('admin.products.editor.variantsDescription')}
          >
            {currencies.map((c) => (
              <input key={c} type="hidden" name="currencies[]" value={c} />
            ))}
            <VariantPriceGrid
              variants={product.variants}
              currencies={currencies}
            />
          </FormSection>

          <FormSection
            title={t('admin.products.editor.categoriesTitle')}
            description={t('admin.products.editor.categoriesDescription')}
          >
            <div className="max-w-2xl">
              <CategoryPicker
                allCategories={allCategories}
                selectedIds={product.selectedCategoryIds}
              />
            </div>
          </FormSection>

          <FormSection
            title={t('admin.products.editor.mediaTitle')}
            description={t('admin.products.editor.mediaDescription')}
            last
          >
            <div className="max-w-2xl">
              <MediaUploader
                initialMedia={product.media}
                disabled={isCreate}
                disabledMessage={t('admin.products.editor.mediaDisabled')}
              />
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        {!isCreate ? (
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              onClick={(e) => {
                if (!window.confirm(t('admin.products.editor.confirmDelete'))) {
                  e.preventDefault();
                }
              }}
              className="text-danger hover:text-danger/80 text-sm/6 font-semibold transition-colors"
            >
              {t('admin.products.editor.delete')}
            </button>
          </Form>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/products"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="product-editor-form" disabled={isSaving}>
            {isSaving
              ? isCreate
                ? t('admin.products.editor.creating')
                : t('admin.products.editor.saving')
              : isCreate
                ? t('admin.products.editor.create')
                : t('admin.products.editor.save')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
