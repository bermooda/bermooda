// POST /api/admin/v1/marketing/campaigns/:id/send — send campaign
// Requires admin-scoped API key.

import { sendCampaign } from '#/core/marketing/index.server';

export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const result = await sendCampaign(params.id);
    return Response.json(result);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (err.code === 'CAMPAIGN_ALREADY_SENT') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    throw err;
  }
}
