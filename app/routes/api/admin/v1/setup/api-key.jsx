// POST /api/admin/v1/setup/api-key — create the first bootstrap API key
// No existing berm_ key required. Guarded by SETUP_TOKEN (see .env.example).
// Prefer CLI seed/bootstrap when SETUP_TOKEN is unset.

import {
  createDomainErrorMapper,
  parseOptionalJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';
import {
  createBootstrapApiKey,
  isSetupTokenAuthorized,
} from '#/core/setup/index.server';

export const middleware = [rateLimitMiddleware('api-admin')];

const mapSetupError = createDomainErrorMapper({
  conflict: ['BOOTSTRAP_KEY_EXISTS'],
  badRequest: [
    'LABEL_REQUIRED',
    'SCOPES_REQUIRED',
    'SCOPES_INVALID',
    'EXPIRES_AT_INVALID',
  ],
});

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  if (!isSetupTokenAuthorized(request)) {
    return Response.json(
      {
        error:
          'Bootstrap API key creation requires a valid SETUP_TOKEN (X-Setup-Token or Authorization Bearer). Or create the key via CLI seed/bootstrap.',
        code: 'SETUP_TOKEN_REQUIRED',
      },
      { status: 401 }
    );
  }

  const parsed = await parseOptionalJsonBody(request, {
    defaultValue: {},
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  try {
    const result = await createBootstrapApiKey(parsed.body);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return mapSetupError(err);
  }
}
