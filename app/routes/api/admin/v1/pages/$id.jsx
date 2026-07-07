// GET /api/admin/v1/pages/:id — get page
// PATCH /api/admin/v1/pages/:id — update page
// DELETE /api/admin/v1/pages/:id — delete page
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  deletePage,
  loadPageEditorData,
  parseUpdatePageInput,
  updatePage,
} from '#/core/content/index.server';

const mapPageError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: ['INVALID_PAGE_STATUS', 'SLUG_INVALID', 'SLUG_RESERVED'],
});

export async function loader({ params }) {
  try {
    const data = await loadPageEditorData(params.id);
    return Response.json({ page: data.page });
  } catch (err) {
    return mapPageError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'DELETE') {
    try {
      await deletePage(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return mapPageError(err);
    }
  }

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    parseUpdatePageInput(parsed.body);
    await updatePage(params.id, parsed.body);
    const data = await loadPageEditorData(params.id);
    return Response.json({ page: data.page });
  } catch (err) {
    return mapPageError(err);
  }
}
