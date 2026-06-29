import { useState } from 'react';
import { Form, Link } from 'react-router';

import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import Tabs from '#/components/admin/tabs';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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

export default function PageEditor({
  mode = 'edit',
  page,
  locales,
  translationMap,
  slugMap,
  actionData,
  isSaving,
}) {
  const primaryLocale = locales[0] ?? 'en';
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const isCreate = mode === 'create';
  const isPublished = page.status === 'published';

  const displayTitle = isCreate
    ? 'New page'
    : translationMap[primaryLocale]?.title ||
      slugMap[primaryLocale] ||
      `Page ${page.id.slice(0, 8)}`;

  const updatedDate = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const subtitle = isCreate ? (
    'Create a CMS page with localized content and SEO metadata.'
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={isPublished ? 'success' : 'warn'}>
        {isPublished ? 'Published' : 'Draft'}
      </Badge>
      {updatedDate && <span>Updated {updatedDate}</span>}
    </span>
  );

  const t = translationMap[activeLocale] ?? {};

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Pages', href: '/admin/pages' },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      {actionData?.ok && <SuccessAlert message="Page saved." />}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      <Form method="post" className="space-y-6">
        {!isCreate && (
          <input type="hidden" name="locale" value={activeLocale} />
        )}

        <Card>
          <CardHeader
            title="Content"
            description="Localized title, body, URL slug, and SEO metadata."
          />

          {!isCreate && (
            <div className="mb-5">
              <Field label="Status" htmlFor="page-status">
                <Select
                  id="page-status"
                  name="status"
                  defaultValue={page.status}
                  className="max-w-xs"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </Field>
            </div>
          )}

          {isCreate ? (
            <div className="space-y-5">
              <Field label="Title" htmlFor="page-title">
                <Input id="page-title" name="title" type="text" required />
              </Field>
              <Field label="URL slug" htmlFor="page-slug">
                <div className="relative">
                  <span className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    /
                  </span>
                  <Input
                    id="page-slug"
                    name="slug"
                    type="text"
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    className="pl-7"
                  />
                </div>
              </Field>
            </div>
          ) : (
            <>
              <LocaleTabs
                locales={locales}
                activeLocale={activeLocale}
                onSelect={setActiveLocale}
              />
              <div className="space-y-5 pt-5">
                <Field label="Title" htmlFor={`title-${activeLocale}`}>
                  <Input
                    id={`title-${activeLocale}`}
                    name="title"
                    type="text"
                    defaultValue={t.title ?? ''}
                  />
                </Field>
                <Field
                  label={`URL slug (${activeLocale})`}
                  htmlFor={`slug-${activeLocale}`}
                >
                  <div className="relative">
                    <span className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      /
                    </span>
                    <Input
                      id={`slug-${activeLocale}`}
                      name="slug"
                      type="text"
                      defaultValue={slugMap[activeLocale] ?? ''}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      className="pl-7"
                    />
                  </div>
                </Field>
                <Field label="Body" htmlFor={`body-${activeLocale}`}>
                  <Textarea
                    id={`body-${activeLocale}`}
                    name="body"
                    rows={10}
                    defaultValue={t.body ?? ''}
                  />
                </Field>
                <div className="bg-surface-2/70 border-border rounded-lg border p-4">
                  <p className="text-text-muted mb-4 text-xs font-semibold tracking-wide uppercase">
                    SEO
                  </p>
                  <div className="space-y-4">
                    <Field
                      label="Meta title"
                      htmlFor={`meta-title-${activeLocale}`}
                    >
                      <Input
                        id={`meta-title-${activeLocale}`}
                        name="metaTitle"
                        type="text"
                        defaultValue={t.metaTitle ?? ''}
                      />
                    </Field>
                    <Field
                      label="Meta description"
                      htmlFor={`meta-desc-${activeLocale}`}
                    >
                      <Textarea
                        id={`meta-desc-${activeLocale}`}
                        name="metaDescription"
                        rows={2}
                        defaultValue={t.metaDescription ?? ''}
                      />
                    </Field>
                  </div>
                </div>
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
                  if (!window.confirm('Delete this page?')) {
                    e.preventDefault();
                  }
                }}
                className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
              >
                Delete page
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? isCreate
                  ? 'Creating…'
                  : 'Saving…'
                : isCreate
                  ? 'Create page'
                  : 'Save page'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
