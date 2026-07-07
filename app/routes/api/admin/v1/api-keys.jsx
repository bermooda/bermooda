// GET /api/admin/v1/api-keys — list API keys
// Requires admin-scoped API key. (Key creation is via the admin UI only.)

import {
  listApiKeys,
  parseApiKeyListParams,
} from '#/core/api-keys/index.server';

function apiKeyErrorResponse(err) {
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  try {
    const params = parseApiKeyListParams(new URL(request.url).searchParams);
    const result = await listApiKeys(params);
    return Response.json(result);
  } catch (err) {
    return apiKeyErrorResponse(err);
  }
}
