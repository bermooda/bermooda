// GET /api/admin/v1/api-keys/:id — get API key
// DELETE /api/admin/v1/api-keys/:id — revoke API key
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { getApiKey, revokeApiKey } from '#/core/api-keys/index.server';

const mapApiKeyError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const apiKey = await getApiKey(params.id);
    return Response.json({ apiKey });
  } catch (err) {
    return mapApiKeyError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'DELETE');
  if (methodError) return methodError;

  try {
    await revokeApiKey(params.id);
    return Response.json({ revoked: true });
  } catch (err) {
    return mapApiKeyError(err);
  }
}
