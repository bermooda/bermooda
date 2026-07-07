// GET /api/admin/v1/address-validation/providers

import { listProvidersWithDetails } from '#/core/address-validation/index.server';

export async function loader() {
  return Response.json({ providers: listProvidersWithDetails() });
}
