// GET /api/admin/v1/marketing/campaigns — list campaigns
// POST /api/admin/v1/marketing/campaigns — create campaign
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import { createCampaign, listCampaigns } from '#/core/marketing/index.server';

const mapCampaignError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams, {
    limit: 50,
  });

  const { campaigns, total } = await listCampaigns({ page, limit });
  return jsonListResponse('campaigns', {
    items: campaigns,
    total,
    page,
    limit,
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const campaign = await createCampaign(parsed.body);
    return Response.json({ campaign }, { status: 201 });
  } catch (err) {
    if (err.code === 'CAMPAIGN_INVALID') {
      return jsonDomainError(err);
    }
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Segment not found' }, { status: 404 });
    }
    return mapCampaignError(err);
  }
}
