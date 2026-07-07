import { listLocationsWithInventory } from '#/core/inventory/index.server';

export async function loader({ request }) {
  const locations = await listLocationsWithInventory();

  return Response.json({ locations });
}
