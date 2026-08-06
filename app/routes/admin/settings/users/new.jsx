import { useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import {
  createAdminStaffUser,
  requirePermission,
  SETTINGS_MANAGE_PERMISSION,
} from '#/core/rbac/index.server';
import AdminUserEditor from '#/components/admin/admin-user-editor';

export async function action({ request }) {
  const session = await authenticate(request);

  try {
    await requirePermission(session.user, SETTINGS_MANAGE_PERMISSION);
    const formData = await request.formData();
    await createAdminStaffUser({
      email: formData.get('email'),
      name: formData.get('name'),
    });
    return { ok: true };
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return { error: 'Forbidden' };
    }
    return { error: err.message };
  }
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminNewAdminUserRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <AdminUserEditor actionData={actionData} isSaving={isSaving} />;
}
