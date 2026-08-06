import {
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
import ScheduledExportEditor from '#/components/admin/scheduled-export-editor';

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
  const { exportTypes, exportSchedules } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <ScheduledExportEditor
      exportTypes={exportTypes}
      exportSchedules={exportSchedules}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
