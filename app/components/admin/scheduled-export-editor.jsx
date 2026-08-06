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
 * Admin scheduled export create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {string[]} props.exportTypes
 * @param {string[]} props.exportSchedules
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ScheduledExportEditor({
  exportTypes,
  exportSchedules,
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
                label: t('admin.reports.index.title'),
                href: '/admin/reports',
              },
              { label: t('admin.reports.schedulesNew.breadcrumb') },
            ]}
          />
        }
        title={t('admin.reports.schedulesNew.title')}
        subtitle={t('admin.reports.schedulesNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="scheduled-export-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.reports.schedulesNew.cardTitle')}
            description={t('admin.reports.schedulesNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={t('admin.reports.schedulesNew.label')}
                htmlFor="export-label"
              >
                <Input
                  id="export-label"
                  name="label"
                  required
                  placeholder={t('admin.reports.schedulesNew.labelPlaceholder')}
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.reports.schedulesNew.exportType')}
                htmlFor="export-type"
              >
                <Select
                  id="export-type"
                  name="exportType"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t('admin.reports.schedulesNew.selectType')}
                  </option>
                  {exportTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.reports.schedulesNew.schedule')}
                htmlFor="export-schedule"
              >
                <Select
                  id="export-schedule"
                  name="schedule"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t('admin.reports.schedulesNew.selectSchedule')}
                  </option>
                  {exportSchedules.map((scheduleOption) => (
                    <option key={scheduleOption} value={scheduleOption}>
                      {scheduleOption}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                className="sm:col-span-3"
                label={t('admin.reports.schedulesNew.recipientEmail')}
                htmlFor="export-email"
              >
                <Input
                  id="export-email"
                  name="recipientEmail"
                  type="email"
                  placeholder={t(
                    'admin.reports.schedulesNew.recipientPlaceholder'
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
            to="/admin/reports"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="scheduled-export-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.reports.schedulesNew.creating')
              : t('admin.reports.schedulesNew.create')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
