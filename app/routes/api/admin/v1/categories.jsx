// GET /api/admin/v1/categories — list categories
// POST /api/admin/v1/categories — create category
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createCategory,
  getCategory,
  listCategories,
} from '#/core/catalog/index.server';
import { get } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

const mapCategoryError = createDomainErrorMapper({
  badRequest: ['CATEGORY_INVALID'],
});

/**
 * @param {object} body
 * @param {string} defaultLocale
 * @returns {object}
 */
function normalizeCategoryWriteBody(body, defaultLocale) {
  const locale = body.locale?.toString().trim() || defaultLocale;
  const title =
    body.title !== undefined
      ? String(body.title).trim()
      : body.name !== undefined
        ? String(body.name).trim()
        : undefined;
  const slug = body.slug !== undefined ? String(body.slug).trim() : undefined;
  const parentId =
    body.parentId === undefined ||
    body.parentId === null ||
    body.parentId === ''
      ? null
      : String(body.parentId);
  const position =
    body.position !== undefined && body.position !== null
      ? Number(body.position)
      : undefined;

  return {
    ...(title !== undefined ? { title } : {}),
    ...(slug !== undefined ? { slug } : {}),
    locale,
    parentId,
    ...(Number.isFinite(position) ? { position } : {}),
  };
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const locale =
    url.searchParams.get('locale') ||
    (await get(SETTING_KEYS.DEFAULT_LOCALE)) ||
    'en';

  const categories = await listCategories({ locale });
  return Response.json({ categories, locale });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  const defaultLocale = (await get(SETTING_KEYS.DEFAULT_LOCALE)) || 'en';
  const input = normalizeCategoryWriteBody(parsed.body, defaultLocale);

  if (!input.title) {
    return Response.json(
      { error: 'title is required', code: 'CATEGORY_INVALID' },
      { status: 400 }
    );
  }

  try {
    const created = await createCategory(input);
    const category = await getCategory(created.id, { locale: input.locale });
    return Response.json({ category: category ?? created }, { status: 201 });
  } catch (err) {
    if (err.message === 'Slug already taken') {
      return Response.json({ error: err.message }, { status: 409 });
    }
    return mapCategoryError(err);
  }
}
