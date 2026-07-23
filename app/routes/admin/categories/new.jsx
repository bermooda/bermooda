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
              { label: 'Categories', href: '/admin/categories' },
              { label: 'New category' },
            ]}
          />
        }
        title="New category"
        subtitle="Add a category to organize your product catalog."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Category details"
            description="English name and slug. Parent is optional for nested categories."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (EN) *" htmlFor="category-title">
              <Input
                id="category-title"
                type="text"
                name="title"
                required
                placeholder="e.g. Apparel"
              />
            </Field>
            <Field label="Slug (EN)" htmlFor="category-slug">
              <Input
                id="category-slug"
                type="text"
                name="slug"
                placeholder="apparel"
              />
            </Field>
            <Field label="Parent (optional)" htmlFor="category-parent">
              <Select id="category-parent" name="parentId" defaultValue="">
                <option value="">— None (root) —</option>
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create category'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
