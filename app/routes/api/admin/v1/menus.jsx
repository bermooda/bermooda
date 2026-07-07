// GET /api/admin/v1/menus — list menus
// Requires admin-scoped API key.

import { DEFAULT_MENU_HANDLES, listMenus } from '#/core/content/index.server';

export async function loader() {
  const menus = await listMenus();
  return Response.json({ menus, menuHandles: DEFAULT_MENU_HANDLES });
}
