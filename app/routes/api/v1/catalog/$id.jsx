// GET /api/v1/catalog/:id — single product by id (public)

import { getProduct } from '#/core/catalog/index.server';

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';

  try {
    const product = await getProduct(params.id, { locale, currency });
    return Response.json({ product });
  } catch (err) {
    if (err.code === 'PRODUCT_NOT_FOUND') {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    throw err;
  }
}
