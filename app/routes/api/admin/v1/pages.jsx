// GET /api/admin/v1/pages — list pages
// POST /api/admin/v1/pages — create page
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  createPage,
  listPages,
  loadPageEditorData,
  PAGE_STATUSES,
  parseCreatePageInput,
  parsePageListParams,
} from '#/core/content/index.server';

function pageErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'INVALID_PAGE_STATUS' ||
    err.code === 'SLUG_REQUIRED' ||
    err.code === 'SLUG_INVALID' ||
    err.code === 'SLUG_RESERVED' ||
    err.code === 'TITLE_REQUIRED'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);

  try {
    const params = parsePageListParams(url.searchParams);
    const result = await listPages(params);
    return Response.json({
      ...result,
      pageStatuses: PAGE_STATUSES,
    });
  } catch (err) {
    if (err.code === 'INVALID_PAGE_STATUS') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    throw err;
  }
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    parseCreatePageInput(body);
    const page = await createPage(body);
    const hydrated = await loadPageEditorData(page.id);
    return Response.json({ page: hydrated.page }, { status: 201 });
  } catch (err) {
    return pageErrorResponse(err);
  }
}
