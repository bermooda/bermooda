// DELETE /api/admin/v1/api-keys/:id — revoke an API key
// Requires admin-scoped API key.

import { revokeApiKey } from '#/core/api-keys/index.server';

export async function action({ request, params }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await revokeApiKey(params.id);
    return Response.json({ revoked: true });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
