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
 * Admin price list create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string }>} props.groups
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function PriceListEditor({ groups, actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.priceLists.index.title'),
                href: '/admin/price-lists',
              },
              { label: t('admin.priceLists.new.breadcrumb') },
            ]}
          />
        }
        title={t('admin.priceLists.new.title')}
        subtitle={t('admin.priceLists.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="price-list-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.priceLists.new.cardTitle')}
            description={t('admin.priceLists.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.priceLists.new.name')}
                htmlFor="price-list-name"
              >
                <Input
                  id="price-list-name"
                  name="name"
                  required
                  placeholder={t('admin.priceLists.new.namePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.priceLists.new.currency')}
                htmlFor="price-list-currency"
              >
                <Input
                  id="price-list-currency"
                  name="currency"
                  required
                  defaultValue="USD"
                  maxLength={3}
                  className="uppercase"
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.priceLists.new.customerGroup')}
                htmlFor="price-list-group"
              >
                <Select
                  id="price-list-group"
                  name="customerGroupId"
                  defaultValue=""
                >
                  <option value="">
                    {t('admin.priceLists.new.allCustomers')}
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.priceLists.new.priority')}
                htmlFor="price-list-priority"
              >
                <Input
                  id="price-list-priority"
                  name="priority"
                  type="number"
                  defaultValue="0"
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
            to="/admin/price-lists"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="price-list-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.priceLists.new.creating')
              : t('admin.priceLists.new.create')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
