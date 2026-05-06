// app/routes/admin/products/new.jsx
// New product form — creates a blank product and redirects to the full editor.

import { Form, useActionData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const slug = formData.get('slug')?.toString().trim();

  if (!slug) {
    return { error: 'Slug is required.' };
  }

  // Validate slug format
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      error:
        'Slug must be lowercase letters, numbers and hyphens only (no spaces).',
    };
  }

  // Check slug uniqueness
  const existing = await prisma.slug.findUnique({ where: { slug } });
  if (existing) {
    return { error: `Slug "${slug}" is already taken.` };
  }

  // Create the product with a default variant
  const product = await prisma.product.create({
    data: {
      variants: {
        create: [{ inventoryCount: 0, inventoryTracked: true, position: 0 }],
      },
    },
  });

  // Create the en slug
  await prisma.slug.create({
    data: {
      entityType: 'product',
      entityId: product.id,
      locale: 'en',
      slug,
    },
  });

  return redirect(`/admin/products/${product.id}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminNewProductRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          New Product
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter a unique slug to create the product and open the full editor.
        </p>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <Form method="post">
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              URL Slug
            </label>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
              Lowercase letters, numbers and hyphens only. This is the URL-safe
              identifier for the product.
            </p>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              autoFocus
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="my-new-product"
              className="mt-2 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
            />
          </div>

          {actionData?.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {actionData.error}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
            >
              {isSubmitting ? 'Creating…' : 'Create Product'}
            </button>
            <a
              href="/admin/products"
              className="text-sm text-gray-600 hover:underline dark:text-zinc-400"
            >
              Cancel
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
}
