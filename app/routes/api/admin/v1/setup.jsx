// GET /api/admin/v1/setup — bootstrap status (no API key required)
// Rate-limited; safe to expose (no secrets).

import { rateLimitMiddleware } from '#/libs/rate-limit.server';
import { getSetupStatus } from '#/core/setup/index.server';

export const middleware = [rateLimitMiddleware('api-admin')];

export async function loader() {
  const setup = await getSetupStatus();
  return Response.json({ setup });
}
