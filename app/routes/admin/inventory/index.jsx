// app/routes/admin/inventory/index.jsx
// Multi-location inventory admin.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import {
  ensureDefaultLocation,
  listInventoryLevelsForVariants,
  listLocations,
  listRecentVariantsForInventory,
  setInventoryLevelQuantity,
} from '#/core/inventory/index.server';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

export async function loader() {
  await ensureDefaultLocation();
  const variants = await listRecentVariantsForInventory();
  const [locations, levelsByVariant] = await Promise.all([
    listLocations(),
    listInventoryLevelsForVariants(variants.map((variant) => variant.id)),
  ]);

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

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminInventoryRoute() {
  const { locations, variants, levelsByVariant } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Inventory by location"
        subtitle="Stock levels per warehouse location. Totals sync to variant inventory counts."
        actions={
          <Link
            to="/admin/inventory/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New location
          </Link>
        }
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
