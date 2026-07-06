// GET /api/admin/v1/api-keys — list API keys
// Requires admin-scoped API key. (Key creation is via the admin UI only.)

import { requireApiKey } from '#/libs/auth/api.server';
import { listApiKeys } from '#/core/api-keys/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);
  const keys = await listApiKeys();
  return Response.json({ apiKeys: keys });
}
