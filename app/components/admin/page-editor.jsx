import { useState } from 'react';
import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import LocaleTabs from '#/components/admin/locale-tabs';
import PageHeader from '#/components/admin/page-header';
import SeoFields from '#/components/admin/seo-fields';
import SlugField from '#/components/admin/slug-field';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Shared admin CMS page editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{ status: string, id?: string, updatedAt?: string }} props.page
 * @param {string[]} props.locales
 * @param {Record<string, Record<string, string>>} props.translationMap
 * @param {Record<string, string>} props.slugMap
 * @param {Object} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function PageEditor({
  mode = 'edit',
  page,
  locales,
  translationMap,
  slugMap,
  actionData,
  isSaving,
}) {
  const t = useT();
  const primaryLocale = locales[0] ?? 'en';
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const isCreate = mode === 'create';
  const isPublished = page.status === 'published';

  const displayTitle = isCreate
    ? t('admin.pages.index.newButton')
    : translationMap[primaryLocale]?.title ||
      slugMap[primaryLocale] ||
      t('admin.pages.editor.fallbackTitle', { id: page.id.slice(0, 8) });

  const updatedDate = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const subtitle = isCreate ? (
    t('admin.pages.editor.createSubtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={isPublished ? 'success' : 'warn'}>
        {isPublished
          ? t('admin.pages.status.published')
          : t('admin.pages.status.draft')}
      </Badge>
      {updatedDate && (
        <span>{t('admin.pages.editor.updated', { date: updatedDate })}</span>
      )}
    </span>
  );

  const localeFields = translationMap[activeLocale] ?? {};

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: t('admin.pages.index.title'), href: '/admin/pages' },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      {actionData?.ok && (
        <SuccessAlert message={t('admin.pages.editor.saved')} />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" className="space-y-6">
        {!isCreate && (
          <input type="hidden" name="locale" value={activeLocale} />
        )}

        <Card>
          <CardHeader
            title={t('admin.pages.editor.contentTitle')}
            description={t('admin.pages.editor.contentDescription')}
          />

          {!isCreate && (
            <div className="mb-5">
              <Field
                label={t('admin.pages.editor.statusLabel')}
                htmlFor="page-status"
              >
                <Select
                  id="page-status"
                  name="status"
                  defaultValue={page.status}
                  className="max-w-xs"
                >
                  <option value="draft">{t('admin.pages.status.draft')}</option>
                  <option value="published">
                    {t('admin.pages.status.published')}
                  </option>
                </Select>
              </Field>
            </div>
          )}

          {isCreate ? (
            <div className="space-y-5">
              <Field
                label={t('admin.pages.editor.titleLabel')}
                htmlFor="page-title"
              >
                <Input id="page-title" name="title" type="text" required />
              </Field>
              <SlugField
                id="page-slug"
                name="slug"
                label={t('admin.pages.editor.slugLabel')}
                required
              />
            </div>
          ) : (
            <>
              <LocaleTabs
                locales={locales}
                activeLocale={activeLocale}
                onSelect={setActiveLocale}
              />
              <div className="space-y-5 pt-5">
                <Field
                  label={t('admin.pages.editor.titleLabel')}
                  htmlFor={`title-${activeLocale}`}
                >
                  <Input
                    id={`title-${activeLocale}`}
                    name="title"
                    type="text"
                    defaultValue={localeFields.title ?? ''}
                  />
                </Field>
                <SlugField
                  id={`slug-${activeLocale}`}
                  name="slug"
                  label={t('admin.pages.editor.slugLabelLocale', {
                    locale: activeLocale,
                  })}
                  defaultValue={slugMap[activeLocale] ?? ''}
                />
                <Field
                  label={t('admin.pages.editor.bodyLabel')}
                  htmlFor={`body-${activeLocale}`}
                >
                  <Textarea
                    id={`body-${activeLocale}`}
                    name="body"
                    rows={10}
                    defaultValue={localeFields.body ?? ''}
                  />
                </Field>
                <SeoFields
                  titleFieldName="metaTitle"
                  descriptionFieldName="metaDescription"
                  titleId={`meta-title-${activeLocale}`}
                  descriptionId={`meta-desc-${activeLocale}`}
                  titleLabel={t('admin.pages.editor.metaTitle')}
                  descriptionLabel={t('admin.pages.editor.metaDescription')}
                  defaultTitle={localeFields.metaTitle ?? ''}
                  defaultDescription={localeFields.metaDescription ?? ''}
                />
              </div>
            </>
          )}
        </Card>

        <ActionBar>
          {!isCreate ? (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <button
                type="submit"
                onClick={(e) => {
                  if (!window.confirm(t('admin.pages.editor.confirmDelete'))) {
                    e.preventDefault();
                  }
                }}
                className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
              >
                {t('admin.pages.editor.delete')}
              </button>
            </Form>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Link
              to="/admin/pages"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? isCreate
                  ? t('admin.pages.editor.creating')
                  : t('admin.pages.editor.saving')
                : isCreate
                  ? t('admin.pages.editor.create')
                  : t('admin.pages.editor.save')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
