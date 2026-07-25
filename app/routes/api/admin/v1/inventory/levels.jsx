// PUT /api/admin/v1/inventory/levels — set quantity for a variant at a location
// Requires admin-scoped API key (or inventory:write).

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { requireAdminApiScope } from '#/libs/auth/api/index.server';
import { setInventoryLevelQuantity } from '#/core/inventory/index.server';

const mapInventoryError = createDomainErrorMapper({
  badRequest: ['INVENTORY_INVALID'],
  notFound: ['NOT_FOUND'],
});

export async function action({ request, context }) {
  requireAdminApiScope(context, 'inventory:write');

  const methodError = requireMethod(request, 'PUT');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  const variantId = String(parsed.body.variantId ?? '').trim();
  const locationId = String(parsed.body.locationId ?? '').trim();
  const quantityRaw = parsed.body.quantity;
  const quantity = Number(quantityRaw);

  if (!variantId || !locationId || !Number.isFinite(quantity) || quantity < 0) {
    return Response.json(
      {
        error: 'variantId, locationId, and non-negative quantity are required',
        code: 'INVENTORY_INVALID',
      },
      { status: 400 }
    );
  }

  try {
    const level = await setInventoryLevelQuantity(
      variantId,
      locationId,
      Math.floor(quantity)
    );
    return Response.json({ level });
  } catch (err) {
    return mapInventoryError(err);
  }
}
