import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';
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
  const code = formData.get('code')?.toString().trim().toUpperCase() ?? '';
  const type = formData.get('type')?.toString() ?? '';
  const value = parseInt(formData.get('value') ?? '0', 10);
  const minSubtotalCents = formData.get('minSubtotalCents')?.toString().trim()
    ? parseInt(formData.get('minSubtotalCents'), 10)
    : null;
  const maxUsesCount = formData.get('maxUsesCount')?.toString().trim()
    ? parseInt(formData.get('maxUsesCount'), 10)
    : null;
  const currency = formData.get('currency')?.toString().trim() || null;
  const expiresAtRaw = formData.get('expiresAt')?.toString().trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  if (!code) return { error: 'Code is required.' };
  if (!type) return { error: 'Type is required.' };
  if (!value || value <= 0) {
    return { error: 'Value must be greater than 0.' };
  }
  if (type === 'fixed' && !currency) {
    return { error: 'Currency is required for fixed discounts.' };
  }

  try {
    await prisma.discount.create({
      data: {
        code,
        type,
        value,
        minSubtotalCents,
        maxUsesCount,
        currency: type === 'fixed' ? currency : null,
        expiresAt,
        active: true,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return { error: 'A discount with that code already exists.' };
    }
    throw err;
  }

  return redirect('/admin/discounts');
}

export default function AdminNewDiscountRoute() {
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
              { label: 'Discounts', href: '/admin/discounts' },
              { label: 'New discount' },
            ]}
          />
        }
        title="New discount"
        subtitle="Create a promo code for checkout discounts."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Discount details"
            description="Configure code, type, value, and optional usage limits."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Code *" htmlFor="discount-code">
              <Input
                id="discount-code"
                type="text"
                name="code"
                required
                placeholder="SUMMER20"
                className="uppercase"
              />
            </Field>
            <Field label="Type *" htmlFor="discount-type">
              <Select
                id="discount-type"
                name="type"
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field
              label={`Value *${type === 'percent' ? ' (%)' : ' (cents)'}`}
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
              label="Currency"
              htmlFor="discount-currency"
              className={clsx(type !== 'fixed' && 'invisible')}
            >
              <Input
                id="discount-currency"
                type="text"
                name="currency"
                placeholder="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field
              label="Min subtotal (cents, optional)"
              htmlFor="discount-min-subtotal"
            >
              <Input
                id="discount-min-subtotal"
                type="number"
                name="minSubtotalCents"
                min="0"
                placeholder="e.g. 5000"
              />
            </Field>
            <Field label="Max uses (optional)" htmlFor="discount-max-uses">
              <Input
                id="discount-max-uses"
                type="number"
                name="maxUsesCount"
                min="1"
                placeholder="e.g. 100"
              />
            </Field>
            <Field label="Expires at (optional)" htmlFor="discount-expires">
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create discount'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
