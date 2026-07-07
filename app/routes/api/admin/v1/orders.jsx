// GET /api/admin/v1/orders — list orders
// Requires admin-scoped API key.

import {
  jsonListResponse,
  parseAdminListPagination,
} from '#/libs/api/admin.server';
import { listOrders } from '#/core/orders/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const status = url.searchParams.get('status') ?? undefined;
  const customerId = url.searchParams.get('customerId') ?? undefined;

  const { orders, total } = await listOrders({
    page,
    limit,
    status,
    customerId,
  });
  return jsonListResponse('orders', { items: orders, total, page, limit });
}
