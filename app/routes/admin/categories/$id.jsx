import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  loadCategoryAdminEditData,
  saveCategoryAdminForm,
} from '#/core/catalog/admin/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Textarea from '#/components/admin/form/textarea';
import LocaleTabs from '#/components/admin/locale-tabs';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  const data = await loadCategoryAdminEditData(params.id);
  if (!data) {
    throw new Response('Category not found', { status: 404 });
  }
  return data;
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    await saveCategoryAdminForm(params.id, formData);
    return redirect('/admin/categories');
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.categories.edit',
      shape: 'error',
      userMessage: 'Could not save category.',
    });
  }
}

export function meta({ loaderData }) {
  const title = loaderData?.category?.enTitle || 'Edit category';
  return [{ title: `${title} — Categories` }];
}

export default function AdminEditCategoryRoute() {
  const { category, locales } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Categories', href: '/admin/categories' },
              { label: category.enTitle || 'Edit category' },
            ]}
          />
        }
        title={category.enTitle || 'Edit category'}
        subtitle="Update translations, slugs, and SEO fields."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        {locales.map((locale) => (
          <input key={locale} type="hidden" name="locales[]" value={locale} />
        ))}

        <Card>
          <CardHeader
            title="Localized details"
            description="Edit title, slug, and meta fields per locale."
          />

          <LocaleTabs
            locales={locales}
            activeLocale={activeLocale}
            onSelect={setActiveLocale}
          />

          {locales.map((locale) => (
            <div
              key={locale}
              className={clsx(
                'mt-4 space-y-4',
                locale !== activeLocale && 'hidden'
              )}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Title (${locale})`} htmlFor={`title-${locale}`}>
                  <Input
                    id={`title-${locale}`}
                    type="text"
                    name={`title[${locale}]`}
                    defaultValue={category.translations[locale]?.title ?? ''}
                    placeholder="Category title"
                  />
                </Field>
                <Field label={`Slug (${locale})`} htmlFor={`slug-${locale}`}>
                  <Input
                    id={`slug-${locale}`}
                    type="text"
                    name={`slug[${locale}]`}
                    defaultValue={category.slugs[locale] ?? ''}
                    placeholder="url-slug"
                  />
                </Field>
              </div>
              <Field
                label={`Meta title (${locale})`}
                htmlFor={`metaTitle-${locale}`}
              >
                <Input
                  id={`metaTitle-${locale}`}
                  type="text"
                  name={`metaTitle[${locale}]`}
                  defaultValue={category.translations[locale]?.metaTitle ?? ''}
                />
              </Field>
              <Field
                label={`Meta description (${locale})`}
                htmlFor={`metaDescription-${locale}`}
              >
                <Textarea
                  id={`metaDescription-${locale}`}
                  name={`metaDescription[${locale}]`}
                  rows={2}
                  defaultValue={
                    category.translations[locale]?.metaDescription ?? ''
                  }
                />
              </Field>
            </div>
          ))}
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/categories"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save category'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
