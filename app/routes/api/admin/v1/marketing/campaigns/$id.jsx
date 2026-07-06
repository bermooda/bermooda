// GET /api/admin/v1/marketing/campaigns/:id — get campaign
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { getCampaign } from '#/core/marketing/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const campaign = await getCampaign(params.id);
    return Response.json({ campaign });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }
    throw err;
  }
}
