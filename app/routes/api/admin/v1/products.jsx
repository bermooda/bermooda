// GET /api/admin/v1/products — list products
// POST /api/admin/v1/products — create product
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { listProducts, createProduct } from '#/core/catalog/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const published = url.searchParams.has('published')
    ? url.searchParams.get('published') === 'true'
    : undefined;

  const { products, total } = await listProducts({
    page,
    limit,
    locale,
    currency,
    categoryId,
    published,
  });

  return Response.json({ products, total, page, limit });
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const product = await createProduct(body);
    return Response.json({ product }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
