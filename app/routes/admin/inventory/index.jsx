// app/routes/admin/inventory/index.jsx
// Multi-location inventory admin.

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Inventory by location
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock levels per warehouse location. Totals sync to variant inventory
          counts.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium text-slate-900 dark:text-white">
          Locations
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {locations.map((location) => (
            <li key={location.id}>
              {location.name} ({location.code})
              {location.isDefault ? ' — default' : ''}
            </li>
          ))}
        </ul>

        <Form method="post" className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="intent" value="create-location" />
          <input
            name="name"
            placeholder="Location name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            name="code"
            placeholder="code"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add location
          </button>
        </Form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium text-slate-900 dark:text-white">
          Variant stock
        </h2>
        <div className="mt-4 space-y-6">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="border-b border-slate-100 pb-4 dark:border-slate-800"
            >
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {variant.sku || variant.id}{' '}
                <span className="text-slate-500">
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
                    <input type="hidden" name="variantId" value={variant.id} />
                    <input
                      type="hidden"
                      name="locationId"
                      value={level.locationId}
                    />
                    <span className="text-slate-600 dark:text-slate-300">
                      {level.location.name}
                    </span>
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      defaultValue={level.quantity}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
                    >
                      Save
                    </button>
                  </Form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
