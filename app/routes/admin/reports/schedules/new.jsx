import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  createScheduledExport,
  parseCreateScheduledExportInput,
} from '#/core/exports/index.server';
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

export default function AdminNewScheduledExportRoute() {
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
              { label: 'Reports', href: '/admin/reports' },
              { label: 'New scheduled export' },
            ]}
          />
        }
        title="New scheduled export"
        subtitle="Schedule recurring CSV exports delivered by email."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Export schedule"
            description="Exports run automatically on the selected schedule."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label *" htmlFor="export-label">
              <Input
                id="export-label"
                name="label"
                required
                placeholder="Weekly orders export"
              />
            </Field>
            <Field label="Export type *" htmlFor="export-type">
              <Select
                id="export-type"
                name="exportType"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select type
                </option>
                {exportTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Schedule *" htmlFor="export-schedule">
              <Select
                id="export-schedule"
                name="schedule"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select schedule
                </option>
                {exportSchedules.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Recipient email (optional)" htmlFor="export-email">
              <Input
                id="export-email"
                name="recipientEmail"
                type="email"
                placeholder="ops@example.com"
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create schedule'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
