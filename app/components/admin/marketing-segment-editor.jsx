import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Admin marketing segment create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string }>} props.groups
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function MarketingSegmentEditor({
  groups,
  actionData,
  isSaving,
}) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.marketing.segmentsNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.segmentsNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.segmentsNew.title')}
        subtitle={t('admin.marketing.segmentsNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="marketing-segment-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.marketing.segmentsNew.cardTitle')}
            description={t('admin.marketing.segmentsNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.segmentsNew.name')}
                htmlFor="segment-name"
              >
                <Input
                  id="segment-name"
                  name="name"
                  required
                  placeholder={t('admin.marketing.segmentsNew.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.segmentsNew.minOrders')}
                htmlFor="segment-min-orders"
              >
                <Input
                  id="segment-min-orders"
                  name="minOrders"
                  type="number"
                  min="0"
                  placeholder={t(
                    'admin.marketing.segmentsNew.minOrdersPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.segmentsNew.minSpent')}
                htmlFor="segment-min-spent"
              >
                <Input
                  id="segment-min-spent"
                  name="minSpentCents"
                  type="number"
                  min="0"
                  placeholder={t(
                    'admin.marketing.segmentsNew.minSpentPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.segmentsNew.customerGroup')}
                htmlFor="segment-group"
              >
                <Select
                  id="segment-group"
                  name="customerGroupId"
                  defaultValue=""
                >
                  <option value="">
                    {t('admin.marketing.segmentsNew.anyGroup')}
                  </option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/marketing"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit
            form="marketing-segment-editor-form"
            disabled={isSaving}
          >
            {isSaving
              ? t('admin.marketing.segmentsNew.creating')
              : t('admin.marketing.segmentsNew.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
