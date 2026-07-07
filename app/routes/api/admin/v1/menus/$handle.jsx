// GET /api/admin/v1/menus/:handle — get menu
// PUT /api/admin/v1/menus/:handle — upsert menu
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  getMenuForAdmin,
  getMenuOrThrow,
  serializeMenu,
  upsertMenu,
} from '#/core/content/index.server';

const mapMenuError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
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
  const methodError = requireOneOfMethods(request, ['PUT', 'PATCH']);
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    await upsertMenu(params.handle, {
      title: body.title,
      items: Array.isArray(body.items) ? body.items : [],
    });
    const menu = await getMenuOrThrow(params.handle);
    return Response.json({ menu: serializeMenu(menu) });
  } catch (err) {
    return mapMenuError(err);
  }
}
