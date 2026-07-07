// GET /api/admin/v1/products/:id — get product
// PATCH /api/admin/v1/products/:id — update product
// DELETE /api/admin/v1/products/:id — delete product
// Requires admin-scoped API key.

import {
  getProduct,
  updateProduct,
  deleteProduct,
} from '#/core/catalog/index.server';

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

export async function action({ request, params }) {
  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const product = await updateProduct(params.id, body);
      return Response.json({ product });
    } catch (err) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deleteProduct(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
