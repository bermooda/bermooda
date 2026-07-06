// GET /api/admin/v1/discounts — list discounts
// POST /api/admin/v1/discounts — create discount
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { listDiscounts, createDiscount } from '#/core/discounts/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const active = url.searchParams.has('active')
    ? url.searchParams.get('active') === 'true'
    : undefined;

  const { discounts, total } = await listDiscounts({ page, limit, active });
  return Response.json({ discounts, total, page, limit });
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
    const discount = await createDiscount(body);
    return Response.json({ discount }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
