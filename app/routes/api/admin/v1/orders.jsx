// GET /api/admin/v1/orders — list orders
// Requires admin-scoped API key.

import { listOrders } from '#/core/orders/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const status = url.searchParams.get('status') ?? undefined;
  const customerId = url.searchParams.get('customerId') ?? undefined;

  const { orders, total } = await listOrders({
    page,
    limit,
    status,
    customerId,
  });
  return Response.json({ orders, total, page, limit });
}
