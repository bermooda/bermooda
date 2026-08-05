import clsx from 'clsx';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Format a date for an HTML date input (`YYYY-MM-DD`).
 *
 * @param {Date|string|null|undefined} dateVal
 * @returns {string}
 */
function toDateInputValue(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Shared admin discount editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{
 *   id?: string,
 *   code?: string,
 *   type?: string,
 *   value?: number,
 *   currency?: string | null,
 *   minSubtotalCents?: number | null,
 *   maxUsesCount?: number | null,
 *   expiresAt?: string | Date | null,
 *   active?: boolean,
 *   createdAt?: string | Date,
 *   updatedAt?: string | Date,
 * }} [props.discount]
 * @param {{ ok?: boolean, error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function DiscountEditor({
  mode = 'edit',
  discount = {},
  actionData,
  isSaving,
}) {
  const t = useT();
  const isCreate = mode === 'create';
  const [type, setType] = useState(discount.type ?? 'percent');

  const displayTitle = isCreate
    ? t('admin.discounts.new.title')
    : discount.code ||
      t('admin.discounts.editor.fallbackTitle', {
        id: (discount.id ?? '').slice(0, 8),
      });

  const isActive = Boolean(discount.active);
  const updatedDate = discount.updatedAt
    ? new Date(discount.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const subtitle = isCreate ? (
    t('admin.discounts.new.subtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={isActive ? 'success' : 'neutral'}>
        {isActive
          ? t('admin.discounts.status.active')
          : t('admin.discounts.status.inactive')}
      </Badge>
      <Badge tone="accent">
        {type === 'fixed'
          ? t('admin.discounts.type.fixed')
          : t('admin.discounts.type.percent')}
      </Badge>
      {updatedDate ? (
        <span>
          {t('admin.discounts.editor.updated', { date: updatedDate })}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.discounts.index.title'),
                href: '/admin/discounts',
              },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      {actionData?.ok ? (
        <SuccessAlert message={t('admin.discounts.editor.saved')} />
      ) : null}
      {actionData?.error ? <ErrorAlert message={actionData.error} /> : null}

      <Form method="post" id="discount-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.discounts.editor.detailsTitle')}
            description={t('admin.discounts.editor.detailsDescription')}
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.discounts.new.code')}
                htmlFor="discount-code"
              >
                <Input
                  id="discount-code"
                  type="text"
                  name="code"
                  required
                  defaultValue={discount.code ?? ''}
                  placeholder={t('admin.discounts.new.codePlaceholder')}
                  className="uppercase"
                />
              </Field>

              <Field
                className="sm:col-span-3"
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
                className="sm:col-span-3"
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
                  defaultValue={discount.value ?? ''}
                  placeholder={type === 'percent' ? '10' : '1000'}
                />
              </Field>

              <Field
                className={clsx(
                  'sm:col-span-3',
                  type !== 'fixed' && 'invisible'
                )}
                label={t('admin.discounts.new.currency')}
                htmlFor="discount-currency"
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

              {!isCreate ? (
                <div className="col-span-full">
                  <label className="text-text flex cursor-pointer items-center gap-3 text-sm/6">
                    <input
                      type="checkbox"
                      name="active"
                      value="true"
                      defaultChecked={isActive}
                      className="border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded"
                    />
                    {t('admin.discounts.editor.activeLabel')}
                  </label>
                </div>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            title={t('admin.discounts.editor.limitsTitle')}
            description={t('admin.discounts.editor.limitsDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
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
                className="sm:col-span-3"
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
                className="sm:col-span-3"
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
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        {!isCreate ? (
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              onClick={(e) => {
                if (
                  !window.confirm(
                    t('admin.discounts.editor.confirmDelete', {
                      code: discount.code ?? '',
                    })
                  )
                ) {
                  e.preventDefault();
                }
              }}
              className="text-danger hover:text-danger/80 text-sm/6 font-semibold transition-colors"
            >
              {t('admin.discounts.editor.delete')}
            </button>
          </Form>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/discounts"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="discount-editor-form" disabled={isSaving}>
            {isSaving
              ? isCreate
                ? t('admin.discounts.new.creating')
                : t('admin.discounts.edit.saving')
              : isCreate
                ? t('admin.discounts.new.create')
                : t('admin.discounts.edit.save')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
