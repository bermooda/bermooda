// app/routes/admin/inventory/index.jsx
// Multi-location inventory admin.

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import {
  ensureDefaultLocation,
  listLocations,
  listVariantInventoryLevels,
  setInventoryLevelQuantity,
} from '#/core/inventory/index.server';

export async function loader() {
  await ensureDefaultLocation();
  const [locations, variants] = await Promise.all([
    listLocations(),
    prisma.productVariant.findMany({
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        product: true,
        prices: true,
      },
    }),
  ]);

  const levelsByVariant = {};
  for (const variant of variants) {
    levelsByVariant[variant.id] = await listVariantInventoryLevels(variant.id);
  }

  return { locations, variants, levelsByVariant };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'update-level') {
    const variantId = formData.get('variantId')?.toString();
    const locationId = formData.get('locationId')?.toString();
    const quantity = parseInt(formData.get('quantity')?.toString() ?? '0', 10);

    if (!variantId || !locationId || Number.isNaN(quantity) || quantity < 0) {
      return { ok: false, error: 'Invalid inventory update.' };
    }

    await setInventoryLevelQuantity(variantId, locationId, quantity);
    return { ok: true };
  }

  if (intent === 'create-location') {
    const name = formData.get('name')?.toString().trim();
    const code = formData.get('code')?.toString().trim().toLowerCase();
    if (!name || !code) {
      return { ok: false, error: 'Name and code are required.' };
    }

    await prisma.location.create({
      data: { name, code, active: true },
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminInventoryRoute() {
  const { locations, variants, levelsByVariant } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Inventory by location"
        subtitle="Stock levels per warehouse location. Totals sync to variant inventory counts."
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <h2 className="text-text text-lg font-semibold">Locations</h2>
          <ul className="text-text-muted mt-3 space-y-2 text-sm">
            {locations.map((location) => (
              <li key={location.id}>
                {location.name} ({location.code})
                {location.isDefault ? ' — default' : ''}
              </li>
            ))}
          </ul>

          <Form
            method="post"
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="intent" value="create-location" />
            <Input name="name" placeholder="Location name" className="w-auto" />
            <Input name="code" placeholder="code" className="w-auto" />
            <Button type="submit" variant="primary">
              Add location
            </Button>
          </Form>
        </Card>

        <Card>
          <h2 className="text-text text-lg font-semibold">Variant stock</h2>
          <div className="mt-4 space-y-6">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="border-border border-b pb-4 last:border-b-0 last:pb-0"
              >
                <p className="text-text font-medium">
                  {variant.sku || variant.id}{' '}
                  <span className="text-text-muted">
                    (total: {variant.inventoryCount})
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {(levelsByVariant[variant.id] ?? []).map((level) => (
                    <Form
                      key={level.id}
                      method="post"
                      className="flex items-center gap-2 text-sm"
                    >
                      <input type="hidden" name="intent" value="update-level" />
                      <input
                        type="hidden"
                        name="variantId"
                        value={variant.id}
                      />
                      <input
                        type="hidden"
                        name="locationId"
                        value={level.locationId}
                      />
                      <span className="text-text-muted">
                        {level.location.name}
                      </span>
                      <Input
                        name="quantity"
                        type="number"
                        min="0"
                        defaultValue={level.quantity}
                        className="w-20"
                      />
                      <Button type="submit" variant="secondary">
                        Save
                      </Button>
                    </Form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
