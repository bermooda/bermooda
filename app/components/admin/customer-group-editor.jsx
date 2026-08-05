import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Admin customer group create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CustomerGroupEditor({ actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.customerGroups.new.breadcrumb'),
                href: '/admin/customer-groups',
              },
              { label: t('admin.customerGroups.new.title') },
            ]}
          />
        }
        title={t('admin.customerGroups.new.title')}
        subtitle={t('admin.customerGroups.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="customer-group-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.customerGroups.new.cardTitle')}
            description={t('admin.customerGroups.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.customerGroups.new.name')}
                htmlFor="group-name"
              >
                <Input
                  id="group-name"
                  name="name"
                  required
                  placeholder={t('admin.customerGroups.new.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.customerGroups.new.handle')}
                htmlFor="group-handle"
              >
                <Input
                  id="group-handle"
                  name="handle"
                  required
                  placeholder={t('admin.customerGroups.new.handlePlaceholder')}
                />
              </Field>
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/customer-groups"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="customer-group-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.customerGroups.new.creating')
              : t('admin.customerGroups.new.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
