import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Admin marketing campaign create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string }>} props.segments
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function MarketingCampaignEditor({
  segments,
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
                label: t('admin.marketing.campaignsNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.campaignsNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.campaignsNew.title')}
        subtitle={t('admin.marketing.campaignsNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="marketing-campaign-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.marketing.campaignsNew.cardTitle')}
            description={t('admin.marketing.campaignsNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.campaignsNew.segment')}
                htmlFor="campaign-segment"
              >
                <Select
                  id="campaign-segment"
                  name="segmentId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t('admin.marketing.campaignsNew.selectSegment')}
                  </option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.marketing.campaignsNew.name')}
                htmlFor="campaign-name"
              >
                <Input
                  id="campaign-name"
                  name="name"
                  required
                  placeholder={t(
                    'admin.marketing.campaignsNew.namePlaceholder'
                  )}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.marketing.campaignsNew.subject')}
                htmlFor="campaign-subject"
              >
                <Input
                  id="campaign-subject"
                  name="subject"
                  required
                  placeholder={t(
                    'admin.marketing.campaignsNew.subjectPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.marketing.campaignsNew.body')}
                htmlFor="campaign-body"
              >
                <Textarea
                  id="campaign-body"
                  name="bodyHtml"
                  required
                  rows={8}
                  placeholder={t(
                    'admin.marketing.campaignsNew.bodyPlaceholder'
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
            form="marketing-campaign-editor-form"
            disabled={isSaving}
          >
            {isSaving
              ? t('admin.marketing.campaignsNew.creating')
              : t('admin.marketing.campaignsNew.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
