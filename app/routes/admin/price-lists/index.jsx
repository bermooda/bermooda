// app/routes/admin/price-lists/index.jsx

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

import {
  createPriceList,
  listPriceLists,
  upsertPriceListEntry,
} from '#/core/pricing/index.server';

export async function loader() {
  const [priceLists, variants, groups] = await Promise.all([
    listPriceLists(),
    prisma.productVariant.findMany({
      take: 50,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, sku: true },
    }),
    prisma.customerGroup.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return { priceLists, variants, groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-list') {
    const name = formData.get('name')?.toString().trim();
    const currency = formData.get('currency')?.toString().trim().toUpperCase();
    const customerGroupId = formData.get('customerGroupId')?.toString() || null;
    const priority = parseInt(formData.get('priority')?.toString() ?? '0', 10);

    if (!name || !currency) {
      return { ok: false, error: 'Name and currency are required.' };
    }

    await createPriceList({
      name,
      currency,
      customerGroupId: customerGroupId || null,
      priority,
      active: true,
    });
    return { ok: true };
  }

  if (intent === 'add-entry') {
    const priceListId = formData.get('priceListId')?.toString();
    const variantId = formData.get('variantId')?.toString();
    const priceCents = parseInt(
      formData.get('priceCents')?.toString() ?? '0',
      10
    );
    const minQuantity = parseInt(
      formData.get('minQuantity')?.toString() ?? '1',
      10
    );

    if (!priceListId || !variantId || priceCents <= 0) {
      return { ok: false, error: 'Invalid price list entry.' };
    }

    await upsertPriceListEntry({
      priceListId,
      variantId,
      priceCents,
      minQuantity,
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminPriceListsRoute() {
  const { priceLists, variants, groups } = useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Price lists
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Group and quantity-specific pricing overrides.
        </p>
      </div>

      <Form method="post" className="flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="create-list" />
        <input
          name="name"
          placeholder="List name"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="currency"
          defaultValue="USD"
          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <select
          name="customerGroupId"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All customers</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <input
          name="priority"
          type="number"
          defaultValue="0"
          className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Create list
        </button>
      </Form>

      <section className="space-y-6">
        {priceLists.map((list) => (
          <div
            key={list.id}
            className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="text-lg font-medium">
              {list.name} ({list.currency})
              {list.customerGroup ? ` — ${list.customerGroup.name}` : ''}
            </h2>
            <p className="text-sm text-slate-500">
              Priority {list.priority} · {list._count.entries} entries
            </p>

            <Form method="post" className="mt-4 flex flex-wrap gap-3">
              <input type="hidden" name="intent" value="add-entry" />
              <input type="hidden" name="priceListId" value={list.id} />
              <select
                name="variantId"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku || variant.id}
                  </option>
                ))}
              </select>
              <input
                name="priceCents"
                type="number"
                min="1"
                placeholder="Price (cents)"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <input
                name="minQuantity"
                type="number"
                min="1"
                defaultValue="1"
                className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
              >
                Add entry
              </button>
            </Form>
          </div>
        ))}
      </section>
    </div>
  );
}
