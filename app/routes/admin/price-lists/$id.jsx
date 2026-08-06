import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { useT } from '#/core/i18n';
import { listRecentVariantsForInventory } from '#/core/inventory/index.server';
import {
  getPriceList,
  upsertPriceListEntry,
} from '#/core/pricing/index.server';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  const [priceList, recentVariants] = await Promise.all([
    getPriceList(params.id),
    listRecentVariantsForInventory({ take: 50 }),
  ]);

  if (!priceList) {
    throw new Response('Price list not found', { status: 404 });
  }

  const productIds = recentVariants
    .map((variant) => variant.productId ?? variant.product?.id)
    .filter(Boolean);
  const titleMap = await loadProductTitleMap(productIds);

  const variants = recentVariants.map((variant) => {
    const productId = variant.productId ?? variant.product?.id;
    return {
      id: variant.id,
      sku: variant.sku,
      title: productId ? (titleMap.get(productId) ?? null) : null,
    };
  });

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
  const t = useT();
  const { priceList, variants } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.priceLists.index.title'),
                href: '/admin/price-lists',
              },
              { label: priceList.name },
            ]}
          />
        }
        title={priceList.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{priceList.currency}</Badge>
            {priceList.customerGroup ? (
              <Badge tone="accent">{priceList.customerGroup.name}</Badge>
            ) : null}
            <span>
              {t('admin.priceLists.detail.subtitle', {
                priority: priceList.priority,
                count: priceList._count.entries,
              })}
            </span>
          </span>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok ? <SuccessAlert message={actionData.message} /> : null}

      <div className="space-y-12">
        <FormSection
          title={t('admin.priceLists.detail.entriesTitle')}
          description={t('admin.priceLists.detail.entriesDescription')}
          last
        >
          {(priceList.entries ?? []).length === 0 ? (
            <p className="text-text-muted mb-6 text-sm">
              {t('admin.priceLists.detail.noEntries')}
            </p>
          ) : (
            <ul className="divide-border border-border mb-6 divide-y rounded-lg border text-sm">
              {priceList.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-text font-medium">
                      {entry.variant?.sku || entry.variantId}
                    </p>
                    <p className="text-text-muted text-xs">
                      {entry.variant?.product?.title ??
                        t('admin.priceLists.detail.productFallback')}{' '}
                      ·{' '}
                      {t('admin.priceLists.detail.minQtyMeta', {
                        count: entry.minQuantity,
                      })}
                    </p>
                  </div>
                  <span className="text-text font-mono text-xs tabular-nums">
                    {entry.priceCents}¢
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Form
            method="post"
            className="flex max-w-2xl flex-wrap items-end gap-3"
          >
            <input type="hidden" name="intent" value="add-entry" />
            <Field
              label={t('admin.priceLists.detail.variant')}
              htmlFor="entry-variant"
              className="min-w-0 flex-1"
            >
              <Select id="entry-variant" name="variantId" required>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku || variant.id}
                    {variant.title ? ` — ${variant.title}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('admin.priceLists.detail.priceCents')}
              htmlFor="entry-price"
            >
              <Input
                id="entry-price"
                name="priceCents"
                type="number"
                min="1"
                required
                placeholder={t('admin.priceLists.detail.pricePlaceholder')}
                className="w-32"
              />
            </Field>
            <Field
              label={t('admin.priceLists.detail.minQty')}
              htmlFor="entry-min-qty"
            >
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
              {isSaving
                ? t('admin.priceLists.detail.saving')
                : t('admin.priceLists.detail.addEntry')}
            </ButtonSubmit>
          </Form>
        </FormSection>
      </div>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <Link
          to="/admin/price-lists"
          className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
        >
          {t('admin.priceLists.detail.backToList')}
        </Link>
      </div>
    </div>
  );
}
