// GET /api/admin/v1/categories/:id — get category
// PATCH /api/admin/v1/categories/:id — update category
// DELETE /api/admin/v1/categories/:id — delete category (recursive)
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  jsonResourceOr404,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin/index.server';
import prisma from '#/libs/prisma.server';
import { deleteCategoryRecursive } from '#/core/catalog/admin/index.server';
import { getCategory, updateCategory } from '#/core/catalog/index.server';
import { get } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

const mapCategoryError = createDomainErrorMapper({
  notFound: ['CATEGORY_NOT_FOUND'],
  badRequest: ['CATEGORY_INVALID'],
});

/**
 * @param {object} body
 * @param {string} defaultLocale
 * @returns {object}
 */
function normalizeCategoryPatchBody(body, defaultLocale) {
  const locale = body.locale?.toString().trim() || defaultLocale;
  const patch = { locale };

  if (body.title !== undefined || body.name !== undefined) {
    patch.title =
      body.title !== undefined
        ? String(body.title).trim()
        : String(body.name).trim();
  }
  if (body.slug !== undefined) {
    patch.slug = String(body.slug).trim();
  }
  if (body.parentId !== undefined) {
    patch.parentId =
      body.parentId === null || body.parentId === ''
        ? null
        : String(body.parentId);
  }
  if (body.position !== undefined && body.position !== null) {
    const position = Number(body.position);
    if (Number.isFinite(position)) patch.position = position;
  }

  return patch;
}

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const locale =
    url.searchParams.get('locale') ||
    (await get(SETTING_KEYS.DEFAULT_LOCALE)) ||
    'en';

  const category = await getCategory(params.id, { locale });
  return jsonResourceOr404('category', category, {
    message: 'Category not found',
    code: 'CATEGORY_NOT_FOUND',
  });
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'PATCH') {
    const parsed = await parseJsonBody(request, {
      invalidMessage: 'Invalid JSON',
    });
    if (parsed.error) return parsed.error;

    const existing = await prisma.category.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json(
        { error: 'Category not found', code: 'CATEGORY_NOT_FOUND' },
        { status: 404 }
      );
    }

    const defaultLocale = (await get(SETTING_KEYS.DEFAULT_LOCALE)) || 'en';
    const input = normalizeCategoryPatchBody(parsed.body, defaultLocale);

    try {
      await updateCategory(params.id, input);
      const category = await getCategory(params.id, { locale: input.locale });
      return Response.json({ category });
    } catch (err) {
      if (err.message === 'Slug already taken') {
        return Response.json({ error: err.message }, { status: 409 });
      }
      return mapCategoryError(err);
    }
  }

  const existing = await prisma.category.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json(
      { error: 'Category not found', code: 'CATEGORY_NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    await deleteCategoryRecursive(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return mapCategoryError(err);
  }
}
