// GET /api/admin/v1/admin-users — list admin/staff users
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { listAdminUsers } from '#/core/rbac/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const users = await listAdminUsers();
  return Response.json({ users, total: users.length });
}
