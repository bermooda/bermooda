import { Form, useActionData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        New Page
      </h1>

      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <Form method="post" className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700"
            >
              URL Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>

          {actionData?.error && (
            <p className="text-sm text-red-600">{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create Page'}
          </button>
        </Form>
      </div>
    </div>
  );
}
