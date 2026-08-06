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
 * Admin quote create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string }>} props.companies
 * @param {Array<{
 *   id: string,
 *   sku?: string | null,
 *   product?: { title?: string | null } | null,
 * }>} props.variants
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function QuoteEditor({
  companies,
  variants,
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
                label: t('admin.quotes.new.breadcrumb'),
                href: '/admin/quotes',
              },
              { label: t('admin.quotes.new.title') },
            ]}
          />
        }
        title={t('admin.quotes.new.title')}
        subtitle={t('admin.quotes.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="quote-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.quotes.new.cardTitle')}
            description={t('admin.quotes.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.quotes.new.company')}
                htmlFor="quote-company"
              >
                <Select id="quote-company" name="companyId" required>
                  <option value="">
                    {t('admin.quotes.new.selectCompany')}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.quotes.new.lineItem')}
                htmlFor="quote-variant"
              >
                <Select id="quote-variant" name="variantId" required>
                  <option value="">
                    {t('admin.quotes.new.selectVariant')}
                  </option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku ?? v.id} —{' '}
                      {v.product?.title ??
                        t('admin.quotes.new.productFallback')}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-2"
                label={t('admin.quotes.new.quantity')}
                htmlFor="quote-qty"
              >
                <Input
                  id="quote-qty"
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
              </Field>
              <Field
                className="sm:col-span-2"
                label={t('admin.quotes.new.price')}
                htmlFor="quote-price"
              >
                <Input
                  id="quote-price"
                  name="priceCents"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </Field>
              <Field
                className="sm:col-span-2"
                label={t('admin.quotes.new.currency')}
                htmlFor="quote-currency"
              >
                <Input id="quote-currency" name="currency" defaultValue="USD" />
              </Field>
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/quotes"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="quote-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.quotes.new.creating')
              : t('admin.quotes.new.create')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
