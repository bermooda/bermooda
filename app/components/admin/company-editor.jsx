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
 * Admin company create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CompanyEditor({ actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.companies.new.breadcrumb'),
                href: '/admin/companies',
              },
              { label: t('admin.companies.new.title') },
            ]}
          />
        }
        title={t('admin.companies.new.title')}
        subtitle={t('admin.companies.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="company-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.companies.new.cardTitle')}
            description={t('admin.companies.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.companies.new.name')}
                htmlFor="company-name"
              >
                <Input
                  id="company-name"
                  name="name"
                  required
                  placeholder={t('admin.companies.new.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.companies.new.taxId')}
                htmlFor="company-tax-id"
              >
                <Input
                  id="company-tax-id"
                  name="taxId"
                  placeholder={t('admin.companies.new.taxIdPlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.companies.new.netTerms')}
                htmlFor="company-net-terms"
              >
                <Input
                  id="company-net-terms"
                  name="netTermsDays"
                  type="number"
                  min="0"
                  defaultValue="30"
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
            to="/admin/companies"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="company-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.companies.new.creating')
              : t('admin.companies.new.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
