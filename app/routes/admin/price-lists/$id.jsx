import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { listRecentVariantsForInventory } from '#/core/inventory/index.server';
import {
  getPriceList,
  upsertPriceListEntry,
} from '#/core/pricing/index.server';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  const [priceList, recentVariants] = await Promise.all([
    getPriceList(params.id),
    listRecentVariantsForInventory({ take: 50 }),
  ]);

  if (!priceList) {
    throw new Response('Price list not found', { status: 404 });
  }

  const variants = recentVariants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    title: variant.product?.title ?? null,
  }));

  return { priceList, variants };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'add-entry') {
    const variantId = formData.get('variantId')?.toString();
    const priceCents = parseInt(
      formData.get('priceCents')?.toString() ?? '0',
      10
    );
    const minQuantity = parseInt(
      formData.get('minQuantity')?.toString() ?? '1',
      10
    );

    if (!variantId || priceCents <= 0) {
      return { error: 'Invalid price list entry.' };
    }

    try {
      await upsertPriceListEntry({
        priceListId: params.id,
        variantId,
        priceCents,
        minQuantity,
      });
      return { ok: true, message: 'Entry saved.' };
    } catch (err) {
      return { error: err.message ?? 'Could not save entry.' };
    }
  }

  return { error: 'Unknown action.' };
}

export function meta({ loaderData }) {
  const name = loaderData?.priceList?.name ?? 'Price list';
  return [{ title: `${name} — Price lists` }];
}

export default function AdminPriceListDetailRoute() {
  const { priceList, variants } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Price lists', href: '/admin/price-lists' },
              { label: priceList.name },
            ]}
          />
        }
        title={priceList.name}
        subtitle={`Priority ${priceList.priority} · ${priceList._count.entries} entries`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{priceList.currency}</Badge>
            {priceList.customerGroup && (
              <Badge tone="accent">{priceList.customerGroup.name}</Badge>
            )}
            <Button as={Link} to="/admin/price-lists" variant="secondary">
              Back
            </Button>
          </div>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok && <SuccessAlert message={actionData.message} />}

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Entries"
            description="Variant prices for this list."
          />
          {(priceList.entries ?? []).length === 0 ? (
            <p className="text-text-muted mb-4 text-sm">No entries yet.</p>
          ) : (
            <ul className="divide-border mb-4 divide-y text-sm">
              {priceList.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div>
                    <p className="text-text font-medium">
                      {entry.variant?.sku || entry.variantId}
                    </p>
                    <p className="text-text-muted text-xs">
                      {entry.variant?.product?.title ?? 'Product'} · min qty{' '}
                      {entry.minQuantity}
                    </p>
                  </div>
                  <span className="text-text font-mono text-xs">
                    {entry.priceCents}¢
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="add-entry" />
            <Field label="Variant" htmlFor="entry-variant">
              <Select id="entry-variant" name="variantId" required>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku || variant.id}
                    {variant.title ? ` — ${variant.title}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price (¢)" htmlFor="entry-price">
              <Input
                id="entry-price"
                name="priceCents"
                type="number"
                min="1"
                required
                placeholder="Price (cents)"
                className="w-32"
              />
            </Field>
            <Field label="Min qty" htmlFor="entry-min-qty">
              <Input
                id="entry-min-qty"
                name="minQuantity"
                type="number"
                min="1"
                defaultValue="1"
                className="w-24"
              />
            </Field>
            <ButtonSubmit disabled={isSaving || variants.length === 0}>
              {isSaving ? 'Saving…' : 'Add entry'}
            </ButtonSubmit>
          </Form>
        </Card>

        <ActionBar>
          <span />
          <Link
            to="/admin/price-lists"
            className="text-text-muted hover:text-text text-sm transition-colors"
          >
            Back to price lists
          </Link>
        </ActionBar>
      </div>
    </div>
  );
}
