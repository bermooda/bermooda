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
 * Admin customer create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CustomerEditor({ actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.customers.new.breadcrumb'),
                href: '/admin/customers',
              },
              { label: t('admin.customers.new.title') },
            ]}
          />
        }
        title={t('admin.customers.new.title')}
        subtitle={t('admin.customers.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="customer-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.customers.new.cardTitle')}
            description={t('admin.customers.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-4"
                label={t('admin.customers.new.email')}
                htmlFor="customer-email"
              >
                <Input
                  id="customer-email"
                  type="email"
                  name="email"
                  required
                  placeholder={t('admin.customers.new.emailPlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.customers.new.name')}
                htmlFor="customer-name"
              >
                <Input
                  id="customer-name"
                  type="text"
                  name="name"
                  placeholder={t('admin.customers.new.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.customers.new.phone')}
                htmlFor="customer-phone"
              >
                <Input
                  id="customer-phone"
                  type="tel"
                  name="phone"
                  placeholder={t('admin.customers.new.phonePlaceholder')}
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
            to="/admin/customers"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="customer-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.customers.new.creating')
              : t('admin.customers.new.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
