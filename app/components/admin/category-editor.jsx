import clsx from 'clsx';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import LocaleTabs from '#/components/admin/locale-tabs';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Shared admin category editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{
 *   enTitle?: string,
 *   translations?: Record<string, { title?: string, metaTitle?: string, metaDescription?: string }>,
 *   slugs?: Record<string, string>,
 * }} [props.category]
 * @param {string[]} [props.locales]
 * @param {Array<{ id: string, title: string }>} [props.allForSelect]
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CategoryEditor({
  mode = 'edit',
  category = {},
  locales = [],
  allForSelect = [],
  actionData,
  isSaving,
}) {
  const t = useT();
  const isCreate = mode === 'create';
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  const displayTitle = isCreate
    ? t('admin.categories.new.title')
    : category.enTitle || t('admin.categories.edit.fallbackTitle');

  const subtitle = isCreate
    ? t('admin.categories.new.subtitle')
    : t('admin.categories.edit.subtitle');

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.categories.index.title'),
                href: '/admin/categories',
              },
              {
                label: isCreate
                  ? t('admin.categories.new.breadcrumb')
                  : displayTitle,
              },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="category-editor-form">
        {!isCreate
          ? locales.map((locale) => (
              <input
                key={locale}
                type="hidden"
                name="locales[]"
                value={locale}
              />
            ))
          : null}

        <div className="space-y-12">
          {isCreate ? (
            <FormSection
              title={t('admin.categories.new.cardTitle')}
              description={t('admin.categories.new.cardDescription')}
              last
            >
              <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                <Field
                  className="sm:col-span-3"
                  label={t('admin.categories.new.nameEn')}
                  htmlFor="category-title"
                >
                  <Input
                    id="category-title"
                    type="text"
                    name="title"
                    required
                    placeholder={t('admin.categories.new.namePlaceholder')}
                  />
                </Field>
                <Field
                  className="sm:col-span-3"
                  label={t('admin.categories.new.slugEn')}
                  htmlFor="category-slug"
                >
                  <Input
                    id="category-slug"
                    type="text"
                    name="slug"
                    placeholder={t('admin.categories.new.slugPlaceholder')}
                  />
                </Field>
                <Field
                  className="sm:col-span-3"
                  label={t('admin.categories.new.parent')}
                  htmlFor="category-parent"
                >
                  <Select id="category-parent" name="parentId" defaultValue="">
                    <option value="">
                      {t('admin.categories.new.parentNone')}
                    </option>
                    {allForSelect.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </FormSection>
          ) : (
            <FormSection
              title={t('admin.categories.edit.cardTitle')}
              description={t('admin.categories.edit.cardDescription')}
              last
            >
              <LocaleTabs
                locales={locales}
                activeLocale={activeLocale}
                onSelect={setActiveLocale}
              />

              {locales.map((locale) => (
                <div
                  key={locale}
                  className={clsx(
                    'mt-6 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6',
                    locale !== activeLocale && 'hidden'
                  )}
                >
                  <Field
                    className="sm:col-span-3"
                    label={t('admin.categories.edit.titleLocale', { locale })}
                    htmlFor={`title-${locale}`}
                  >
                    <Input
                      id={`title-${locale}`}
                      type="text"
                      name={`title[${locale}]`}
                      defaultValue={
                        category.translations?.[locale]?.title ?? ''
                      }
                      placeholder={t('admin.categories.edit.titlePlaceholder')}
                    />
                  </Field>
                  <Field
                    className="sm:col-span-3"
                    label={t('admin.categories.edit.slugLocale', { locale })}
                    htmlFor={`slug-${locale}`}
                  >
                    <Input
                      id={`slug-${locale}`}
                      type="text"
                      name={`slug[${locale}]`}
                      defaultValue={category.slugs?.[locale] ?? ''}
                      placeholder={t('admin.categories.edit.slugPlaceholder')}
                    />
                  </Field>
                  <Field
                    className="col-span-full"
                    label={t('admin.categories.edit.metaTitle', { locale })}
                    htmlFor={`metaTitle-${locale}`}
                  >
                    <Input
                      id={`metaTitle-${locale}`}
                      type="text"
                      name={`metaTitle[${locale}]`}
                      defaultValue={
                        category.translations?.[locale]?.metaTitle ?? ''
                      }
                    />
                  </Field>
                  <Field
                    className="col-span-full"
                    label={t('admin.categories.edit.metaDescription', {
                      locale,
                    })}
                    htmlFor={`metaDescription-${locale}`}
                  >
                    <Textarea
                      id={`metaDescription-${locale}`}
                      name={`metaDescription[${locale}]`}
                      rows={2}
                      defaultValue={
                        category.translations?.[locale]?.metaDescription ?? ''
                      }
                    />
                  </Field>
                </div>
              ))}
            </FormSection>
          )}
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/categories"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="category-editor-form" disabled={isSaving}>
            {isSaving
              ? isCreate
                ? t('admin.categories.new.creating')
                : t('admin.categories.edit.saving')
              : isCreate
                ? t('admin.categories.new.create')
                : t('admin.categories.edit.save')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
