import { Form, useActionData } from 'react-router';
import { redirect } from 'react-router';

import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

import { createPage } from '#/core/content/index.server';

export async function action({ request }) {
  const formData = await request.formData();
  const slug = formData.get('slug')?.toString().trim();
  const title = formData.get('title')?.toString().trim();

  if (!slug) return { error: 'Slug is required.' };
  if (!title) return { error: 'Title is required.' };

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers and hyphens only.',
    };
  }

  try {
    const page = await createPage({
      slug,
      locale: 'en',
      translations: { title },
    });
    return redirect(`/admin/pages/${page.id}`);
  } catch (err) {
    return { error: err.message ?? 'Failed to create page.' };
  }
}

export default function AdminNewPageRoute() {
  const actionData = useActionData();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="New Page" className="mb-6" />

      <Card>
        <Form method="post" className="space-y-4">
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" type="text" required />
          </Field>
          <Field label="URL Slug" htmlFor="slug">
            <Input
              id="slug"
              name="slug"
              type="text"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </Field>

          <ErrorAlert message={actionData?.error} />

          <ButtonSubmit>Create Page</ButtonSubmit>
        </Form>
      </Card>
    </div>
  );
}
