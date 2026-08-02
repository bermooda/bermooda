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
  createCategoryFromAdminInput,
  loadCategoryAdminSelectOptions,
  parseCategoryCreateInput,
} from '#/core/catalog/admin/index.server';
import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader() {
  return loadCategoryAdminSelectOptions();
}

export async function action({ request }) {
  const formData = await request.formData();
  const parsed = parseCategoryCreateInput(formData);

  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    await createCategoryFromAdminInput(parsed.data);
    return redirect('/admin/categories');
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.categories.create',
      shape: 'error',
      userMessage: 'Could not create category.',
    });
  }
}

export default function AdminNewCategoryRoute() {
  const t = useT();
  const { allForSelect } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.categories.index.title'),
                href: '/admin/categories',
              },
              { label: t('admin.categories.new.breadcrumb') },
            ]}
          />
        }
        title={t('admin.categories.new.title')}
        subtitle={t('admin.categories.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.categories.new.cardTitle')}
            description={t('admin.categories.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
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
              label={t('admin.categories.new.parent')}
              htmlFor="category-parent"
            >
              <Select id="category-parent" name="parentId" defaultValue="">
                <option value="">{t('admin.categories.new.parentNone')}</option>
                {allForSelect.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/categories"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.categories.new.creating')
                : t('admin.categories.new.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
