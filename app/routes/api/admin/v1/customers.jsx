// GET /api/admin/v1/customers — list customers
// Requires admin-scoped API key.

import { listCustomers } from '#/core/customers/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const q = url.searchParams.get('q') ?? undefined;

  const { customers, total } = await listCustomers({ page, limit, q });

  return Response.json({ customers, total, page, limit });
}
