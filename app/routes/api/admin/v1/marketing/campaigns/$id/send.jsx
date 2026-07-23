// POST /api/admin/v1/marketing/campaigns/:id/send — send campaign
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { sendCampaign } from '#/core/marketing/index.server';

const mapSendCampaignError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function campaignNotFoundResponse() {
  return Response.json({ error: 'Campaign not found' }, { status: 404 });
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  try {
    const result = await sendCampaign(params.id);
    return Response.json(result);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return campaignNotFoundResponse();
    }
    return mapSendCampaignError(err);
  }
}
