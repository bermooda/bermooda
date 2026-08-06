import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

/**
 * Shared admin subscription plan editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{
 *   name?: string,
 *   interval?: string,
 *   intervalCount?: number,
 *   active?: boolean,
 *   variant?: { sku?: string | null } | null,
 * }} [props.plan]
 * @param {Array<{
 *   id: string,
 *   sku?: string | null,
 *   product?: { title?: string | null } | null,
 * }>} [props.variants]
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function SubscriptionPlanEditor({
  mode = 'edit',
  plan = {},
  variants = [],
  actionData,
  isSaving,
}) {
  const t = useT();
  const isCreate = mode === 'create';

  const displayTitle = isCreate
    ? t('admin.subscriptions.new.title')
    : plan.name || t('admin.subscriptions.new.title');

  const subtitle = isCreate ? (
    t('admin.subscriptions.new.subtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={plan.active ? 'success' : 'neutral'}>
        {plan.active
          ? t('admin.subscriptions.status.active')
          : t('admin.subscriptions.status.inactive')}
      </Badge>
      <span>{t('admin.subscriptions.edit.subtitle')}</span>
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: isCreate
                  ? t('admin.subscriptions.new.breadcrumb')
                  : t('admin.subscriptions.edit.breadcrumb'),
                href: '/admin/subscriptions',
              },
              {
                label: isCreate
                  ? t('admin.subscriptions.index.newButton')
                  : displayTitle,
              },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="subscription-plan-editor-form">
        <div className="space-y-12">
          <FormSection
            title={
              isCreate
                ? t('admin.subscriptions.new.cardTitle')
                : t('admin.subscriptions.edit.cardTitle')
            }
            description={
              isCreate
                ? t('admin.subscriptions.new.cardDescription')
                : undefined
            }
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.subscriptions.new.name')
                    : t('admin.subscriptions.edit.name')
                }
                htmlFor="plan-name"
              >
                <Input
                  id="plan-name"
                  name="name"
                  required
                  defaultValue={plan.name ?? ''}
                  placeholder={
                    isCreate
                      ? t('admin.subscriptions.new.namePlaceholder')
                      : undefined
                  }
                />
              </Field>
              {isCreate ? (
                <Field
                  className="sm:col-span-3"
                  label={t('admin.subscriptions.new.variant')}
                  htmlFor="plan-variant"
                >
                  <Select id="plan-variant" name="variantId">
                    <option value="">
                      {t('admin.subscriptions.new.variantNone')}
                    </option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.sku ?? variant.id} —{' '}
                        {variant.product?.title ??
                          t('admin.subscriptions.new.productFallback')}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.subscriptions.new.interval')
                    : t('admin.subscriptions.edit.interval')
                }
                htmlFor="plan-interval"
              >
                <Select
                  id="plan-interval"
                  name="interval"
                  defaultValue={plan.interval ?? 'month'}
                >
                  <option value="day">
                    {t('admin.subscriptions.new.intervalDay')}
                  </option>
                  <option value="week">
                    {t('admin.subscriptions.new.intervalWeek')}
                  </option>
                  <option value="month">
                    {t('admin.subscriptions.new.intervalMonth')}
                  </option>
                  <option value="year">
                    {t('admin.subscriptions.new.intervalYear')}
                  </option>
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.subscriptions.new.every')
                    : t('admin.subscriptions.edit.every')
                }
                htmlFor="plan-interval-count"
              >
                <Input
                  id="plan-interval-count"
                  name="intervalCount"
                  type="number"
                  min="1"
                  defaultValue={plan.intervalCount ?? 1}
                />
              </Field>
              {!isCreate ? (
                <>
                  <div className="col-span-full">
                    <label className="text-text flex cursor-pointer items-center gap-3 text-sm/6">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={Boolean(plan.active)}
                        className={CHECKBOX_CLASS}
                      />
                      {t('admin.subscriptions.edit.active')}
                    </label>
                  </div>
                  {plan.variant?.sku ? (
                    <p className="text-text-muted col-span-full text-sm">
                      {t('admin.subscriptions.edit.linkedVariant', {
                        sku: plan.variant.sku,
                      })}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/subscriptions"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit
            form="subscription-plan-editor-form"
            disabled={isSaving}
          >
            {isSaving
              ? isCreate
                ? t('admin.subscriptions.new.creating')
                : t('admin.subscriptions.edit.saving')
              : isCreate
                ? t('admin.subscriptions.new.create')
                : t('admin.subscriptions.edit.save')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
