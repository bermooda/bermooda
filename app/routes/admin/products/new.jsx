// app/routes/admin/products/new.jsx
// New product form — creates a blank product and redirects to the full editor.

import { Form, Link, useActionData } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="New Product"
        subtitle="Enter a unique slug to create the product and open the full editor."
        className="mb-6"
      />

      <Card>
        <Form method="post" className="space-y-4">
          <Field
            label="URL Slug"
            htmlFor="slug"
            hint="Lowercase letters, numbers and hyphens only. This is the URL-safe identifier for the product."
          >
            <Input
              id="slug"
              name="slug"
              type="text"
              required
              autoFocus
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="my-new-product"
            />
          </Field>

          <ErrorAlert message={actionData?.error} />

          <div className="flex items-center gap-3">
            <ButtonSubmit>Create Product</ButtonSubmit>
            <Link
              to="/admin/products"
              className="text-text-muted hover:text-text text-sm"
            >
              Cancel
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
