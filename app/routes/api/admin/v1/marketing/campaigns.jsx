// GET /api/admin/v1/marketing/campaigns — list campaigns
// POST /api/admin/v1/marketing/campaigns — create campaign
// Requires admin-scoped API key.

import { createCampaign, listCampaigns } from '#/core/marketing/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  );

  const result = await listCampaigns({ page, limit });
  return Response.json(result);
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const campaign = await createCampaign(body);
    return Response.json({ campaign }, { status: 201 });
  } catch (err) {
    if (err.code === 'CAMPAIGN_INVALID') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Segment not found' }, { status: 404 });
    }
    throw err;
  }
}
