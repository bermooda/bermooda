// GET /api/admin/v1/customers — list customers
// Requires admin-scoped API key.

import {
  jsonListResponse,
  parseAdminListPagination,
} from '#/libs/api/admin/index.server';
import { listCustomers } from '#/core/customers/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const q = url.searchParams.get('q') ?? undefined;

  const { customers, total } = await listCustomers({ page, limit, q });

  return jsonListResponse('customers', {
    items: customers,
    total,
    page,
    limit,
  });
}
