// GET /api/v1/catalog — list products (public, no API key required)

import { listProducts } from '#/core/catalog/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;

  const { products, total } = await listProducts({
    page,
    limit,
    locale,
    currency,
    categoryId,
    published: true,
  });

  return Response.json({ products, total, page, limit });
}
