import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

/**
 * Admin inventory location create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function InventoryLocationEditor({ actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.inventory.new.breadcrumbInventory'),
                href: '/admin/inventory',
              },
              { label: t('admin.inventory.new.breadcrumbNew') },
            ]}
          />
        }
        title={t('admin.inventory.new.title')}
        subtitle={t('admin.inventory.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="inventory-location-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.inventory.new.cardTitle')}
            description={t('admin.inventory.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.inventory.new.name')}
                htmlFor="location-name"
              >
                <Input
                  id="location-name"
                  name="name"
                  required
                  placeholder={t('admin.inventory.new.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.inventory.new.code')}
                htmlFor="location-code"
              >
                <Input
                  id="location-code"
                  name="code"
                  required
                  placeholder={t('admin.inventory.new.codePlaceholder')}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.inventory.new.pickup')}
                htmlFor="allows-pickup"
              >
                <label className="text-text flex cursor-pointer items-center gap-3 text-sm/6">
                  <input
                    id="allows-pickup"
                    name="allowsPickup"
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                  />
                  {t('admin.inventory.new.pickupLabel')}
                </label>
              </Field>
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/inventory"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit
            form="inventory-location-editor-form"
            disabled={isSaving}
          >
            {isSaving
              ? t('admin.inventory.new.creating')
              : t('admin.inventory.new.create')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
