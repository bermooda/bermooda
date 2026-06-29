import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';
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
  const categories = await prisma.category.findMany({
    orderBy: { position: 'asc' },
  });

  const catIds = categories.map((c) => c.id);
  const translations =
    catIds.length > 0
      ? await prisma.translation.findMany({
          where: { entityType: 'category', entityId: { in: catIds } },
        })
      : [];

  const translationMap = {};
  for (const t of translations) {
    if (!translationMap[t.entityId]) translationMap[t.entityId] = {};
    if (!translationMap[t.entityId][t.locale]) {
      translationMap[t.entityId][t.locale] = {};
    }
    translationMap[t.entityId][t.locale][t.field] = t.value;
  }

  const allForSelect = categories.map((c) => ({
    id: c.id,
    title: translationMap[c.id]?.en?.title ?? `(${c.id.slice(0, 6)})`,
  }));

  return { allForSelect };
}

export async function action({ request }) {
  const formData = await request.formData();
  const title = formData.get('title')?.toString().trim() ?? '';
  const slugValue = formData.get('slug')?.toString().trim() ?? '';
  const parentId = formData.get('parentId')?.toString().trim() || null;

  if (!title) {
    return { error: 'Name is required.' };
  }

  const lastSibling = await prisma.category.findFirst({
    where: { parentId },
    orderBy: { position: 'desc' },
  });
  const position = (lastSibling?.position ?? -1) + 1;

  const category = await prisma.category.create({
    data: { parentId, position },
  });

  await prisma.translation.create({
    data: {
      entityType: 'category',
      entityId: category.id,
      locale: 'en',
      field: 'title',
      value: title,
    },
  });

  if (slugValue) {
    try {
      await prisma.slug.create({
        data: {
          entityType: 'category',
          entityId: category.id,
          locale: 'en',
          slug: slugValue,
        },
      });
    } catch {
      // Slug collision — category still created
    }
  }

  return redirect('/admin/categories');
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
