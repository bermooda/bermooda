import { useState } from 'react';
import { Form, Link } from 'react-router';

import { currencyInputStep } from '#/core/currency/format';
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
 * Admin gift card issue editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @param {string[]} props.currencies Enabled shop currencies
 * @param {string} props.defaultCurrency
 * @returns {React.ReactElement}
 */
export default function GiftCardEditor({
  actionData,
  isSaving,
  currencies,
  defaultCurrency,
}) {
  const t = useT();
  const [currency, setCurrency] = useState(defaultCurrency);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        sticky
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.giftCards.new.breadcrumb'),
                href: '/admin/gift-cards',
              },
              { label: t('admin.giftCards.new.title') },
            ]}
          />
        }
        title={t('admin.giftCards.new.title')}
        subtitle={t('admin.giftCards.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="gift-card-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.giftCards.new.cardTitle')}
            description={t('admin.giftCards.new.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-2"
                label={t('admin.giftCards.new.code')}
                htmlFor="gift-card-code"
              >
                <Input
                  id="gift-card-code"
                  name="code"
                  placeholder={t('admin.giftCards.new.codePlaceholder')}
                  className="font-mono"
                />
              </Field>
              <Field
                className="sm:col-span-2"
                label={t('admin.giftCards.new.balance')}
                htmlFor="gift-card-balance"
              >
                <Input
                  id="gift-card-balance"
                  name="balance"
                  type="number"
                  min={currencyInputStep(currency)}
                  step={currencyInputStep(currency)}
                  required
                  placeholder={t('admin.giftCards.new.balancePlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-2"
                label={t('admin.giftCards.new.currency')}
                htmlFor="gift-card-currency"
              >
                <Select
                  id="gift-card-currency"
                  name="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
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
            to="/admin/gift-cards"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="gift-card-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.giftCards.new.issuing')
              : t('admin.giftCards.new.issue')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
