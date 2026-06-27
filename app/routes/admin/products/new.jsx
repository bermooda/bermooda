// app/routes/admin/products/new.jsx
// New product form — creates a blank product and redirects to the full editor.

import { CubeIcon } from '@heroicons/react/24/outline';
import { Form, Link, useActionData } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
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
    <div className="mx-auto max-w-xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Products', href: '/admin/products' },
              { label: 'New product' },
            ]}
          />
        }
        title="New product"
        subtitle="Start with a URL slug. You can add titles, media, and pricing in the editor."
      />

      <Card>
        <CardHeader
          title="Product URL"
          description="This slug becomes the product's web address. You can localize it later."
        />

        <Form method="post" className="space-y-5">
          <Field
            label="URL slug"
            htmlFor="slug"
            hint="Lowercase letters, numbers, and hyphens only."
          >
            <div className="relative">
              <span className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                /
              </span>
              <Input
                id="slug"
                name="slug"
                type="text"
                required
                autoFocus
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="my-new-product"
                className="pl-7"
              />
            </div>
          </Field>

          <ErrorAlert message={actionData?.error} />

          <div className="border-border flex items-center gap-3 border-t pt-5">
            <ButtonSubmit>Create product</ButtonSubmit>
            <Link
              to="/admin/products"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
          </div>
        </Form>
      </Card>

      <div className="text-text-muted mt-6 flex items-start gap-3 rounded-lg px-1 text-sm">
        <span className="bg-surface-2 text-text-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <CubeIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="leading-relaxed">
          After creation you&apos;ll land in the full product editor to add
          translations, variants, categories, and media.
        </p>
      </div>
    </div>
  );
}
