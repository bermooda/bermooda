// GET /api/admin/v1/api-keys — list API keys
// Requires admin-scoped API key. (Key creation is via the admin UI only.)

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import {
  listApiKeys,
  parseApiKeyListParams,
} from '#/core/api-keys/index.server';

const mapApiKeyError = createDomainErrorMapper({});

export async function loader({ request }) {
  try {
    const params = parseApiKeyListParams(new URL(request.url).searchParams);
    const result = await listApiKeys(params);
    return Response.json(result);
  } catch (err) {
    return mapApiKeyError(err);
  }
}
