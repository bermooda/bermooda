// GET /api/admin/v1/api-keys/:id — get API key
// DELETE /api/admin/v1/api-keys/:id — revoke API key
// Requires admin-scoped API key.

import { getApiKey, revokeApiKey } from '#/core/api-keys/index.server';

function apiKeyErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const apiKey = await getApiKey(params.id);
    return Response.json({ apiKey });
  } catch (err) {
    return apiKeyErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await revokeApiKey(params.id);
    return Response.json({ revoked: true });
  } catch (err) {
    return apiKeyErrorResponse(err);
  }
}
