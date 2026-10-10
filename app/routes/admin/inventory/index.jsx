// app/routes/admin/inventory/index.jsx
// Multi-location inventory admin.

import { BuildingStorefrontIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import {
  ensureDefaultLocation,
  listInventoryLevelsForVariants,
  listLocations,
  listRecentVariantsForInventory,
  setInventoryLevelQuantity,
} from '#/core/inventory/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
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
  const t = useT();
  const { locations, variants, levelsByVariant } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.inventory.index.title')}
        subtitle={t('admin.inventory.index.subtitle')}
        actions={
          <Link
            to="/admin/inventory/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.inventory.index.newButton')}
          </Link>
        }
      />

      {variants.length === 0 ? (
        <EmptyState
          icon={BuildingStorefrontIcon}
          title={t('admin.inventory.index.emptyTitle')}
          description={t('admin.inventory.index.emptyDescription')}
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.inventory.index.col.variant')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-right">
                {t('admin.inventory.index.col.total')}
              </Th>
              {locations.map((location) => (
                <Th key={location.id} sticky className="px-3 py-3.5">
                  <span className="flex items-center gap-2">
                    {location.name}
                    {location.isDefault && (
                      <Badge>{t('admin.inventory.index.defaultBadge')}</Badge>
                    )}
                  </span>
                  <span className="text-text-muted block font-mono text-xs font-normal">
                    {location.code}
                  </span>
                </Th>
              ))}
            </tr>
          </THead>
          <TBody sticky>
            {variants.map((variant) => {
              const levels = levelsByVariant[variant.id] ?? [];
              return (
                <Tr key={variant.id}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-mono font-medium sm:pl-0"
                  >
                    {variant.sku || variant.id}
                  </Td>
                  <Td sticky className="px-3 py-4 text-right tabular-nums">
                    {variant.inventoryCount}
                  </Td>
                  {locations.map((location) => {
                    const level = levels.find(
                      (entry) => entry.locationId === location.id
                    );
                    return (
                      <Td key={location.id} sticky className="px-3 py-3">
                        {level ? (
                          <Form
                            method="post"
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="update-level"
                            />
                            <input
                              type="hidden"
                              name="variantId"
                              value={variant.id}
                            />
                            <input
                              type="hidden"
                              name="locationId"
                              value={location.id}
                            />
                            <Input
                              name="quantity"
                              type="number"
                              min="0"
                              defaultValue={level.quantity}
                              aria-label={`${variant.sku || variant.id} — ${location.name}`}
                              className="w-24 tabular-nums"
                            />
                            <Button type="submit" variant="secondary">
                              {t('common.save')}
                            </Button>
                          </Form>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
