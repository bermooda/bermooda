import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  getDiscount,
  parseDiscountFormData,
  updateDiscount,
} from '#/core/discounts/index.server';
import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/** @param {Date|string|null|undefined} dateVal */
function toDateInputValue(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function loader({ params }) {
  const discount = await getDiscount(params.id);
  if (!discount) {
    throw new Response('Discount not found', { status: 404 });
  }
  return { discount };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const active = formData.get('active') === 'true';
  const parsed = parseDiscountFormData(formData, { active });
  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    await updateDiscount(params.id, parsed.data);
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.discounts.edit',
      shape: 'error',
      knownCodes: {
        P2002: { error: 'A discount with that code already exists.' },
      },
      userMessage: 'Could not save discount.',
    });
  }

  return redirect('/admin/discounts');
}

export function meta({ loaderData }) {
  const code = loaderData?.discount?.code ?? 'Edit discount';
  return [{ title: `${code} — Discounts` }];
}

export default function AdminEditDiscountRoute() {
  const t = useT();
  const { discount } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const [type, setType] = useState(discount.type ?? 'percent');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.discounts.edit.breadcrumb'),
                href: '/admin/discounts',
              },
              { label: discount.code },
            ]}
          />
        }
        title={discount.code}
        subtitle={t('admin.discounts.edit.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <input type="hidden" name="active" value={String(discount.active)} />

        <Card>
          <CardHeader
            title={t('admin.discounts.edit.cardTitle')}
            description={t('admin.discounts.edit.cardDescription')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.discounts.new.code')}
              htmlFor="discount-code"
            >
              <Input
                id="discount-code"
                type="text"
                name="code"
                required
                defaultValue={discount.code}
                placeholder={t('admin.discounts.new.codePlaceholder')}
                className="uppercase"
              />
            </Field>
            <Field
              label={t('admin.discounts.new.type')}
              htmlFor="discount-type"
            >
              <Select
                id="discount-type"
                name="type"
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="percent">
                  {t('admin.discounts.new.typePercent')}
                </option>
                <option value="fixed">
                  {t('admin.discounts.new.typeFixed')}
                </option>
              </Select>
            </Field>
            <Field
              label={
                type === 'percent'
                  ? t('admin.discounts.new.valuePercent')
                  : t('admin.discounts.new.valueCents')
              }
              htmlFor="discount-value"
            >
              <Input
                id="discount-value"
                type="number"
                name="value"
                required
                min="1"
                defaultValue={discount.value}
                placeholder={type === 'percent' ? '10' : '1000'}
              />
            </Field>
            <Field
              label={t('admin.discounts.new.currency')}
              htmlFor="discount-currency"
              className={clsx(type !== 'fixed' && 'invisible')}
            >
              <Input
                id="discount-currency"
                type="text"
                name="currency"
                defaultValue={discount.currency ?? ''}
                placeholder={t('admin.discounts.new.currencyPlaceholder')}
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field
              label={t('admin.discounts.new.minSubtotal')}
              htmlFor="discount-min-subtotal"
            >
              <Input
                id="discount-min-subtotal"
                type="number"
                name="minSubtotalCents"
                min="0"
                defaultValue={discount.minSubtotalCents ?? ''}
                placeholder={t('admin.discounts.new.minSubtotalPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.discounts.new.maxUses')}
              htmlFor="discount-max-uses"
            >
              <Input
                id="discount-max-uses"
                type="number"
                name="maxUsesCount"
                min="1"
                defaultValue={discount.maxUsesCount ?? ''}
                placeholder={t('admin.discounts.new.maxUsesPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.discounts.new.expiresAt')}
              htmlFor="discount-expires"
            >
              <Input
                id="discount-expires"
                type="date"
                name="expiresAt"
                defaultValue={toDateInputValue(discount.expiresAt)}
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/discounts"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.discounts.edit.saving')
                : t('admin.discounts.edit.save')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
