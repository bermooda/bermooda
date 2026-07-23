// GET /api/v1/search — storefront search (public)

import { search } from '#/core/search/index.server';
import { parsePublicSearchParams } from '#/core/search/params';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parsePublicSearchParams(url);
  const { query, page, limit, locale, currency, sort, filters } = params;

  const result = await search({
    query,
    filters,
    sort,
    page,
    limit,
    locale,
    currency,
  });

  return Response.json({ ...result, page, limit, query });
}
