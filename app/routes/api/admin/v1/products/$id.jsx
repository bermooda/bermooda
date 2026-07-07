// GET /api/admin/v1/products/:id — get product
// PATCH /api/admin/v1/products/:id — update product
// DELETE /api/admin/v1/products/:id — delete product
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonResourceOr404,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  getProduct,
  updateProduct,
  deleteProduct,
} from '#/core/catalog/index.server';

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';

  const product = await getProduct(params.id, { locale, currency });
  return jsonResourceOr404('product', product, {
    message: 'Product not found',
  });
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'PATCH') {
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;

    try {
      const product = await updateProduct(params.id, parsed.body);
      return Response.json({ product });
    } catch (err) {
      return jsonDomainError(err);
    }
  }

  try {
    await deleteProduct(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return jsonDomainError(err);
  }
}
