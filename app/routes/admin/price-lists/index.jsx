// app/routes/admin/price-lists/index.jsx

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

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
    <div>
      <PageHeader
        title="Price lists"
        subtitle="Group and quantity-specific pricing overrides."
        className="mb-6"
      />

      <Card className="mb-6">
        <Form method="post" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="create-list" />
          <Input name="name" placeholder="List name" className="w-auto" />
          <Input name="currency" defaultValue="USD" className="w-24" />
          <Select name="customerGroupId" className="w-auto">
            <option value="">All customers</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Input
            name="priority"
            type="number"
            defaultValue="0"
            className="w-20"
          />
          <Button type="submit" variant="primary">
            Create list
          </Button>
        </Form>
      </Card>

      {priceLists.length === 0 ? (
        <EmptyState
          title="No price lists yet"
          description="Create a price list above to add group or quantity-specific pricing."
        />
      ) : (
        <div className="space-y-6">
          {priceLists.map((list) => (
            <Card key={list.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-text text-lg font-semibold">{list.name}</h2>
                <Badge tone="neutral">{list.currency}</Badge>
                {list.customerGroup && (
                  <Badge tone="accent">{list.customerGroup.name}</Badge>
                )}
              </div>
              <p className="text-text-muted mt-1 text-sm">
                Priority {list.priority} · {list._count.entries} entries
              </p>

              <Form
                method="post"
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="intent" value="add-entry" />
                <input type="hidden" name="priceListId" value={list.id} />
                <Select name="variantId" className="w-auto">
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.sku || variant.id}
                    </option>
                  ))}
                </Select>
                <Input
                  name="priceCents"
                  type="number"
                  min="1"
                  placeholder="Price (cents)"
                  className="w-32"
                />
                <Input
                  name="minQuantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  className="w-20"
                />
                <Button type="submit" variant="secondary">
                  Add entry
                </Button>
              </Form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
