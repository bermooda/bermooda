// GET /api/admin/v1/storage — storage configuration status
// Requires admin-scoped API key.

import { loadStorageStatus } from '#/core/storage/index.server';

export async function loader() {
  return Response.json(loadStorageStatus());
}
