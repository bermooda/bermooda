// GET /api/admin/v1/menus/:handle — get menu
// PUT /api/admin/v1/menus/:handle — upsert menu
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getMenuForAdmin,
  getMenuOrThrow,
  serializeMenu,
  upsertMenu,
} from '#/core/content/index.server';

function menuErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  const menu = await getMenuForAdmin(params.handle);
  if (!menu) {
    return Response.json(
      { error: 'Menu not found.', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  return Response.json({ menu: serializeMenu(menu) });
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'PUT' && request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await upsertMenu(params.handle, {
      title: body.title,
      items: Array.isArray(body.items) ? body.items : [],
    });
    const menu = await getMenuOrThrow(params.handle);
    return Response.json({ menu: serializeMenu(menu) });
  } catch (err) {
    return menuErrorResponse(err);
  }
}
