// GET /api/admin/v1/pages — list pages
// POST /api/admin/v1/pages — create page
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createPage,
  listPages,
  loadPageEditorData,
  PAGE_STATUSES,
  parseCreatePageInput,
  parsePageListParams,
} from '#/core/content/index.server';

const mapPageError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'INVALID_PAGE_STATUS',
    'SLUG_REQUIRED',
    'SLUG_INVALID',
    'SLUG_RESERVED',
    'TITLE_REQUIRED',
  ],
});

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parsePageListParams(url.searchParams);
    const result = await listPages(params);
    return Response.json({
      ...result,
      pageStatuses: PAGE_STATUSES,
    });
  } catch (err) {
    return mapPageError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    parseCreatePageInput(body);
    const page = await createPage(body);
    const hydrated = await loadPageEditorData(page.id);
    return Response.json({ page: hydrated.page }, { status: 201 });
  } catch (err) {
    return mapPageError(err);
  }
}
