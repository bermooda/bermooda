// GET /api/admin/v1/marketing/campaigns/:id — get campaign
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import { getCampaign } from '#/core/marketing/index.server';

const mapCampaignError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function campaignNotFoundResponse() {
  return Response.json({ error: 'Campaign not found' }, { status: 404 });
}

export async function loader({ params }) {
  try {
    const campaign = await getCampaign(params.id);
    return Response.json({ campaign });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return campaignNotFoundResponse();
    }
    return mapCampaignError(err);
  }
}
