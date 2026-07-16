// app/routes/admin/price-lists/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import { listRecentVariantsForInventory } from '#/core/inventory/index.server';
import {
  listPriceLists,
  upsertPriceListEntry,
} from '#/core/pricing/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

export async function loader() {
  const [priceLists, recentVariants] = await Promise.all([
    listPriceLists(),
    listRecentVariantsForInventory({ take: 50 }),
  ]);

  const variants = recentVariants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
  }));

  return { priceLists, variants };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

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
  const { priceLists, variants } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Price lists"
        subtitle="Group and quantity-specific pricing overrides."
        actions={
          <Link
            to="/admin/price-lists/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New price list
          </Link>
        }
        className="mb-6"
      />

      {priceLists.length === 0 ? (
        <EmptyState
          title="No price lists yet"
          description="Create a price list to add group or quantity-specific pricing."
          action={
            <Link
              to="/admin/price-lists/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              New price list
            </Link>
          }
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
                  className="w-24"
                />
                <Button type="submit" variant="primary">
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
