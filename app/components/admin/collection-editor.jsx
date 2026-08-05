import clsx from 'clsx';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

/**
 * @returns {{ type: string, value: string }}
 */
function emptyCondition() {
  return { type: 'tag', value: '' };
}

/**
 * Smart-collection rules builder (match mode + condition rows).
 *
 * @param {Object} props
 * @param {{ match?: string, conditions?: Array<{ type: string, value?: string }> } | null | undefined} props.initialRules
 * @param {Array<{ id: string, title: string }>} props.categories
 * @param {Array<{ id: string, name: string }>} props.tags
 * @returns {React.ReactElement}
 */
function RulesBuilder({ initialRules, categories, tags }) {
  const t = useT();
  const [match, setMatch] = useState(
    initialRules?.match === 'any' ? 'any' : 'all'
  );
  const [conditions, setConditions] = useState(
    initialRules?.conditions?.length
      ? initialRules.conditions.map((c) => ({ ...c }))
      : [emptyCondition()]
  );

  const ruleTypes = [
    { value: 'tag', label: t('admin.collections.edit.ruleTag') },
    { value: 'category', label: t('admin.collections.edit.ruleCategory') },
    { value: 'price_min', label: t('admin.collections.edit.rulePriceMin') },
    { value: 'price_max', label: t('admin.collections.edit.rulePriceMax') },
    { value: 'in_stock', label: t('admin.collections.edit.ruleInStock') },
  ];

  /**
   * @param {number} index
   * @param {string} field
   * @param {string} value
   */
  function updateCondition(index, field, value) {
    setConditions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  /**
   * @param {number} index
   */
  function removeCondition(index) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <Field
        label={t('admin.collections.edit.matchMode')}
        htmlFor="rules-match"
      >
        <Select
          id="rules-match"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
        >
          <option value="all">{t('admin.collections.edit.matchAll')}</option>
          <option value="any">{t('admin.collections.edit.matchAny')}</option>
        </Select>
      </Field>

      <input type="hidden" name="rulesMatch" value={match} />

      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <Field
            label={t('admin.collections.edit.ruleType')}
            className="min-w-40 flex-1"
          >
            <Select
              value={condition.type}
              onChange={(e) => updateCondition(index, 'type', e.target.value)}
            >
              {ruleTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('admin.collections.edit.value')}
            className="min-w-48 flex-1"
          >
            {condition.type === 'category' ? (
              <Select
                value={String(condition.value ?? '')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="">
                  {t('admin.collections.edit.selectCategory')}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </Select>
            ) : condition.type === 'in_stock' ? (
              <Select
                value={String(condition.value ?? 'true')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="true">
                  {t('admin.collections.edit.inStock')}
                </option>
                <option value="false">
                  {t('admin.collections.edit.outOfStock')}
                </option>
              </Select>
            ) : condition.type === 'tag' ? (
              <Select
                value={String(condition.value ?? '')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="">
                  {t('admin.collections.edit.selectTag')}
                </option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type="number"
                min="0"
                value={condition.value ?? ''}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
                placeholder={t('admin.collections.edit.amountPlaceholder')}
              />
            )}
          </Field>

          <input
            type="hidden"
            name={`ruleType[${index}]`}
            value={condition.type}
          />
          <input
            type="hidden"
            name={`ruleValue[${index}]`}
            value={condition.value ?? ''}
          />

          <Button
            type="button"
            variant="secondary"
            onClick={() => removeCondition(index)}
          >
            {t('admin.collections.edit.remove')}
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
      >
        {t('admin.collections.edit.addCondition')}
      </Button>
    </div>
  );
}

/**
 * Manual product multi-select for collections.
 *
 * @param {Object} props
 * @param {Array<{ id: string, title: string, sku?: string, selected?: boolean }>} props.products
 * @returns {React.ReactElement}
 */
function ProductPicker({ products }) {
  const t = useT();

  return (
    <div className="border-border max-h-80 space-y-1 overflow-y-auto rounded-lg border p-2">
      {products.map((product) => (
        <label
          key={product.id}
          className="hover:bg-surface-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors"
        >
          <input
            type="checkbox"
            name="productIds[]"
            value={product.id}
            defaultChecked={product.selected}
            className="border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded"
          />
          <span className="text-text min-w-0 flex-1 truncate text-sm font-medium">
            {product.title}
          </span>
          {product.sku ? (
            <span className="text-text-muted font-mono text-xs">
              {product.sku}
            </span>
          ) : null}
        </label>
      ))}
      {!products.length && (
        <p className="text-text-muted px-2 py-3 text-sm">
          {t('admin.collections.edit.noProducts')}
        </p>
      )}
    </div>
  );
}

/**
 * Shared admin collection editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{
 *   id?: string,
 *   handle?: string,
 *   title?: string,
 *   description?: string,
 *   collectionType?: string,
 *   publishedAt?: string | Date | null,
 *   rules?: { match?: string, conditions?: Array<{ type: string, value?: string }> } | null,
 *   createdAt?: string | Date,
 *   updatedAt?: string | Date,
 * }} [props.collection]
 * @param {Array<{ id: string, title: string, sku?: string, selected?: boolean }>} [props.products]
 * @param {Array<{ id: string, title: string }>} [props.categories]
 * @param {Array<{ id: string, name: string }>} [props.tags]
 * @param {{ ok?: boolean, error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CollectionEditor({
  mode = 'edit',
  collection = {},
  products = [],
  categories = [],
  tags = [],
  actionData,
  isSaving,
}) {
  const t = useT();
  const isCreate = mode === 'create';
  const [collectionType, setCollectionType] = useState(
    collection.collectionType ?? 'manual'
  );

  const displayTitle = isCreate
    ? t('admin.collections.new.title')
    : collection.title ||
      collection.handle ||
      t('admin.collections.editor.fallbackTitle', {
        id: (collection.id ?? '').slice(0, 8),
      });

  const isPublished = Boolean(collection.publishedAt);
  const updatedDate = collection.updatedAt
    ? new Date(collection.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const subtitle = isCreate ? (
    t('admin.collections.new.subtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={isPublished ? 'success' : 'neutral'}>
        {isPublished
          ? t('admin.products.status.published')
          : t('admin.products.status.draft')}
      </Badge>
      <Badge tone="accent">
        {collectionType === 'smart'
          ? t('admin.collections.type.smart')
          : t('admin.collections.type.manual')}
      </Badge>
      {updatedDate ? (
        <span>
          {t('admin.collections.editor.updated', { date: updatedDate })}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.collections.index.title'),
                href: '/admin/collections',
              },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      {actionData?.ok && (
        <SuccessAlert message={t('admin.collections.editor.saved')} />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" id="collection-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.collections.editor.detailsTitle')}
            description={t('admin.collections.editor.detailsDescription')}
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-4"
                label={t('admin.collections.edit.handle')}
                htmlFor="handle"
              >
                <Input
                  id="handle"
                  name="handle"
                  defaultValue={collection.handle ?? ''}
                  required
                />
              </Field>

              <Field
                className="sm:col-span-4"
                label={t('admin.collections.edit.titleLabel')}
                htmlFor="title"
              >
                <Input
                  id="title"
                  name="title"
                  defaultValue={collection.title ?? ''}
                  required
                />
              </Field>

              <Field
                className="col-span-full"
                label={t('admin.collections.edit.description')}
                htmlFor="description"
              >
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={collection.description ?? ''}
                />
              </Field>

              <Field
                className="sm:col-span-3"
                label={t('admin.collections.edit.collectionType')}
                htmlFor="collectionType"
              >
                <Select
                  id="collectionType"
                  name="collectionType"
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value)}
                >
                  <option value="manual">
                    {t('admin.collections.edit.typeManual')}
                  </option>
                  <option value="smart">
                    {t('admin.collections.edit.typeSmart')}
                  </option>
                </Select>
              </Field>

              {!isCreate ? (
                <div className="col-span-full">
                  <label
                    className={clsx(
                      'text-text flex cursor-pointer items-center gap-3 text-sm/6'
                    )}
                  >
                    <input
                      type="checkbox"
                      name="published"
                      defaultChecked={isPublished}
                      className="border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded"
                    />
                    {t('admin.collections.edit.published')}
                  </label>
                </div>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            title={
              collectionType === 'smart'
                ? t('admin.collections.editor.rulesTitle')
                : t('admin.collections.editor.productsTitle')
            }
            description={
              collectionType === 'smart'
                ? t('admin.collections.editor.rulesDescription')
                : t('admin.collections.editor.productsDescription')
            }
            last
          >
            <div className="max-w-2xl">
              {collectionType === 'smart' ? (
                <RulesBuilder
                  initialRules={collection.rules}
                  categories={categories}
                  tags={tags}
                />
              ) : (
                <Field label={t('admin.collections.edit.products')}>
                  <ProductPicker products={products} />
                </Field>
              )}
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
                if (
                  !window.confirm(t('admin.collections.edit.confirmDelete'))
                ) {
                  e.preventDefault();
                }
              }}
              className="text-danger hover:text-danger/80 text-sm/6 font-semibold transition-colors"
            >
              {t('admin.collections.edit.delete')}
            </button>
          </Form>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/collections"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="collection-editor-form" disabled={isSaving}>
            {isSaving
              ? isCreate
                ? t('admin.collections.editor.creating')
                : t('admin.collections.editor.saving')
              : isCreate
                ? t('admin.collections.new.create')
                : t('admin.collections.edit.save')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
