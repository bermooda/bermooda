// GET /api/admin/v1/discounts/:id — get discount
// PATCH /api/admin/v1/discounts/:id — update discount
// DELETE /api/admin/v1/discounts/:id — delete discount
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonResourceOr404,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin/index.server';
import {
  getDiscount,
  updateDiscount,
  deleteDiscount,
} from '#/core/discounts/index.server';

export async function loader({ params }) {
  const discount = await getDiscount(params.id);
  return jsonResourceOr404('discount', discount, {
    message: 'Discount not found',
  });
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'PATCH') {
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;

    try {
      const discount = await updateDiscount(params.id, parsed.body);
      return Response.json({ discount });
    } catch (err) {
      return jsonDomainError(err);
    }
  }

  try {
    await deleteDiscount(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return jsonDomainError(err);
  }
}
