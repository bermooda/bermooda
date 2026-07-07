// GET /api/admin/v1/pages/:id — get page
// PATCH /api/admin/v1/pages/:id — update page
// DELETE /api/admin/v1/pages/:id — delete page
// Requires admin-scoped API key.

import {
  deletePage,
  loadPageEditorData,
  parseUpdatePageInput,
  updatePage,
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
    err.code === 'SLUG_INVALID' ||
    err.code === 'SLUG_RESERVED'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  try {
    const data = await loadPageEditorData(params.id);
    return Response.json({ page: data.page });
  } catch (err) {
    return pageErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method === 'DELETE') {
    try {
      await deletePage(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return pageErrorResponse(err);
    }
  }

  if (request.method === 'PATCH') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      parseUpdatePageInput(body);
      await updatePage(params.id, body);
      const data = await loadPageEditorData(params.id);
      return Response.json({ page: data.page });
    } catch (err) {
      return pageErrorResponse(err);
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
