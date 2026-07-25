// GET /api/admin/v1/api-keys — list API keys
// POST /api/admin/v1/api-keys — create API key (raw key returned once)
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createApiKey,
  listApiKeys,
  parseApiKeyListParams,
} from '#/core/api-keys/index.server';

const mapApiKeyError = createDomainErrorMapper({
  badRequest: [
    'LABEL_REQUIRED',
    'SCOPES_REQUIRED',
    'SCOPES_INVALID',
    'EXPIRES_AT_INVALID',
  ],
});

export async function loader({ request }) {
  try {
    const params = parseApiKeyListParams(new URL(request.url).searchParams);
    const result = await listApiKeys(params);
    return Response.json(result);
  } catch (err) {
    return mapApiKeyError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  try {
    const { key, record } = await createApiKey(parsed.body);
    return Response.json({ key, apiKey: record }, { status: 201 });
  } catch (err) {
    return mapApiKeyError(err);
  }
}
