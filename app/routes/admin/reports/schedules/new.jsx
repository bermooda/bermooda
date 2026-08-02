import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  createScheduledExport,
  parseCreateScheduledExportInput,
} from '#/core/exports/index.server';
import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ request }) {
  await authenticate(request);
  return {
    exportTypes: EXPORT_TYPES,
    exportSchedules: EXPORT_SCHEDULES,
  };
}

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const label = formData.get('label')?.toString().trim();
  const exportType = formData.get('exportType')?.toString();
  const schedule = formData.get('schedule')?.toString();
  const recipientEmail =
    formData.get('recipientEmail')?.toString().trim() || null;

  if (!label || !exportType || !schedule) {
    return { error: 'Label, export type, and schedule are required.' };
  }

  try {
    const input = parseCreateScheduledExportInput({
      label,
      exportType,
      schedule,
      recipientEmail,
    });
    const created = await createScheduledExport(input);
    await recordAdminAudit({
      user,
      action: 'scheduled_export.created',
      entityType: 'scheduled_export',
      entityId: created.id,
      metadata: { label, exportType, schedule },
    });
    return redirect('/admin/reports');
  } catch (err) {
    if (err.code === 'FIELDS_REQUIRED') {
      return { error: err.message };
    }
    return { error: err.message };
  }
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminNewScheduledExportRoute() {
  const t = useT();
  const { exportTypes, exportSchedules } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
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

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.reports.schedulesNew.cardTitle')}
            description={t('admin.reports.schedulesNew.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
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
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/reports"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.reports.schedulesNew.creating')
                : t('admin.reports.schedulesNew.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
