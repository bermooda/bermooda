// POST /api/admin/v1/setup/api-key — create the first bootstrap API key
// No existing berm_ key required. Guarded by SETUP_TOKEN (see .env.example).
// Prefer CLI seed/bootstrap when SETUP_TOKEN is unset.

import {
  createDomainErrorMapper,
  jsonUnexpectedError,
  parseOptionalJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';
import {
  checkSetupToken,
  createBootstrapApiKey,
} from '#/core/setup/index.server';

export const middleware = [rateLimitMiddleware('setup')];

const CONFLICT_CODES = ['BOOTSTRAP_KEY_EXISTS'];
const BAD_REQUEST_CODES = [
  'LABEL_REQUIRED',
  'SCOPES_REQUIRED',
  'SCOPES_INVALID',
  'EXPIRES_AT_INVALID',
];
const DOMAIN_ERROR_CODES = new Set([
  ...CONFLICT_CODES,
  ...BAD_REQUEST_CODES,
  'ADMIN_REQUIRED',
]);

const mapSetupError = createDomainErrorMapper({
  conflict: CONFLICT_CODES,
  badRequest: BAD_REQUEST_CODES,
});

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const tokenError = checkSetupToken(request);
  if (tokenError) {
    return Response.json(tokenError.body, { status: tokenError.status });
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
    if (DOMAIN_ERROR_CODES.has(err?.code)) return mapSetupError(err);
    return jsonUnexpectedError(err, { source: 'api/admin/v1/setup/api-key' });
  }
}
