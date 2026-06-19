// GET /api/v1/search — storefront search (public)

import { search } from '#/core/search/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const sortBy = url.searchParams.get('sortBy') ?? 'relevance';
  const sortDir = url.searchParams.get('sortDir') ?? 'desc';

  const result = await search({
    query: q,
    page,
    limit,
    locale,
    currency,
    categoryId,
    sortBy,
    sortDir,
  });
  return Response.json({ ...result, page, limit, query: q });
}
