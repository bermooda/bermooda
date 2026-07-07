// GET /api/admin/v1/products — list products
// POST /api/admin/v1/products — create product
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseBooleanQueryParam,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import { listProducts, createProduct } from '#/core/catalog/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const published = parseBooleanQueryParam(url.searchParams, 'published');

  const { products, total } = await listProducts({
    page,
    limit,
    locale,
    currency,
    categoryId,
    published,
  });

  return jsonListResponse('products', { items: products, total, page, limit });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const product = await createProduct(parsed.body);
    return Response.json({ product }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
