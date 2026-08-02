import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  createDiscount,
  parseDiscountFormData,
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

export async function action({ request }) {
  const formData = await request.formData();
  const parsed = parseDiscountFormData(formData, { active: true });
  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    await createDiscount(parsed.data);
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.discounts.new',
      shape: 'error',
      knownCodes: {
        P2002: { error: 'A discount with that code already exists.' },
      },
      userMessage: 'Could not create discount.',
    });
  }

  return redirect('/admin/discounts');
}

export default function AdminNewDiscountRoute() {
  const t = useT();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const [type, setType] = useState('percent');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.discounts.new.breadcrumb'),
                href: '/admin/discounts',
              },
              { label: t('admin.discounts.new.title') },
            ]}
          />
        }
        title={t('admin.discounts.new.title')}
        subtitle={t('admin.discounts.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.discounts.new.cardTitle')}
            description={t('admin.discounts.new.cardDescription')}
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
                placeholder={t('admin.discounts.new.maxUsesPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.discounts.new.expiresAt')}
              htmlFor="discount-expires"
            >
              <Input id="discount-expires" type="date" name="expiresAt" />
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
                ? t('admin.discounts.new.creating')
                : t('admin.discounts.new.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
