// GET /api/admin/v1/inventory/locations — list locations with inventory levels
// POST /api/admin/v1/inventory/locations — create a location
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createLocation,
  listLocationsWithInventory,
} from '#/core/inventory/index.server';

const mapLocationError = createDomainErrorMapper({
  badRequest: ['LOCATION_INVALID'],
  conflict: ['LOCATION_CODE_TAKEN'],
});

export async function loader() {
  const locations = await listLocationsWithInventory();
  return Response.json({ locations });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  const name = String(parsed.body.name ?? '').trim();
  const code = String(parsed.body.code ?? '').trim();
  const allowsPickup = Boolean(parsed.body.allowsPickup);

  if (!name || !code) {
    return Response.json(
      { error: 'name and code are required', code: 'LOCATION_INVALID' },
      { status: 400 }
    );
  }

  try {
    const location = await createLocation({ name, code, allowsPickup });
    return Response.json({ location }, { status: 201 });
  } catch (err) {
    const error = /** @type {Error & { code?: string }} */ (err);
    if (
      error.code === 'P2002' ||
      String(error.message || '')
        .toLowerCase()
        .includes('unique')
    ) {
      return Response.json(
        { error: 'Location code already taken', code: 'LOCATION_CODE_TAKEN' },
        { status: 409 }
      );
    }
    return mapLocationError(error);
  }
}
