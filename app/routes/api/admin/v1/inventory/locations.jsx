import { requireApiKey } from '#/libs/auth/api.server';

import { listLocationsWithInventory } from '#/core/inventory/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const locations = await listLocationsWithInventory();

  return Response.json({ locations });
}
