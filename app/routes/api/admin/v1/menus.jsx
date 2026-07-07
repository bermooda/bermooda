// GET /api/admin/v1/menus — list menus
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { DEFAULT_MENU_HANDLES, listMenus } from '#/core/content/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const menus = await listMenus();
  return Response.json({ menus, menuHandles: DEFAULT_MENU_HANDLES });
}
