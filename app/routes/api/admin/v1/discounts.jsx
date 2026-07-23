// GET /api/admin/v1/discounts — list discounts
// POST /api/admin/v1/discounts — create discount
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseBooleanQueryParam,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { listDiscounts, createDiscount } from '#/core/discounts/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const active = parseBooleanQueryParam(url.searchParams, 'active');

  const { discounts, total } = await listDiscounts({ page, limit, active });
  return jsonListResponse('discounts', {
    items: discounts,
    total,
    page,
    limit,
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const discount = await createDiscount(parsed.body);
    return Response.json({ discount }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
