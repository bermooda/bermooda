// GET /api/v1/catalog/:id — single product by id (public)

import { getProduct } from '#/core/catalog/index.server';
import { parsePublicCatalogDetailParams } from '#/core/catalog/params/index';

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const { locale, currency } = parsePublicCatalogDetailParams(url);

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
