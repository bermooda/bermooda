// GET /api/admin/v1/admin-users/:id — get admin/staff user
// PATCH /api/admin/v1/admin-users/:id — update admin/staff role
// Requires admin-scoped API key.

import { getAdminUser, updateAdminUserRole } from '#/core/rbac/index.server';

export async function loader({ request, params }) {
  const user = await getAdminUser(params.id);
  if (!user) {
    return Response.json({ error: 'Admin user not found' }, { status: 404 });
  }

  return Response.json({ user });
}

export async function action({ request, params }) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const user = await updateAdminUserRole(params.id, body.role);
    return Response.json({ user });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.status ?? 422 }
    );
  }
}
