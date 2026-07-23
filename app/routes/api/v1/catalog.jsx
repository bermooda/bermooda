// GET /api/v1/catalog — list products (public, no API key required)

import { listProducts } from '#/core/catalog/index.server';
import { parsePublicCatalogListParams } from '#/core/catalog/params/index';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit, locale, currency, categoryId } =
    parsePublicCatalogListParams(url);

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
