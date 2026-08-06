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
 * Admin marketing abandoned-cart sequence create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function MarketingSequenceEditor({ actionData, isSaving }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.marketing.sequencesNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.sequencesNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.sequencesNew.title')}
        subtitle={t('admin.marketing.sequencesNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="marketing-sequence-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.marketing.sequencesNew.cardTitle')}
            description={t('admin.marketing.sequencesNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.sequencesNew.name')}
                htmlFor="sequence-name"
              >
                <Input
                  id="sequence-name"
                  name="name"
                  required
                  placeholder={t(
                    'admin.marketing.sequencesNew.namePlaceholder'
                  )}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.sequencesNew.stepNumber')}
                htmlFor="sequence-step"
              >
                <Input
                  id="sequence-step"
                  name="stepNumber"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.sequencesNew.delay')}
                htmlFor="sequence-delay"
              >
                <Input
                  id="sequence-delay"
                  name="delayMinutes"
                  type="number"
                  min="1"
                  defaultValue="60"
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.sequencesNew.subject')}
                htmlFor="sequence-subject"
              >
                <Input
                  id="sequence-subject"
                  name="subject"
                  required
                  placeholder={t(
                    'admin.marketing.sequencesNew.subjectPlaceholder'
                  )}
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
            to="/admin/marketing"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit
            form="marketing-sequence-editor-form"
            disabled={isSaving}
          >
            {isSaving
              ? t('admin.marketing.sequencesNew.creating')
              : t('admin.marketing.sequencesNew.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
