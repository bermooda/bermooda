// POST /api/admin/v1/setup/admin — create first admin when onboarding is open
// No API key required. Same gate as the Admin UI onboarding form.

import { parseJsonBody, requireMethod } from '#/libs/api/admin/index.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';
import {
  createSetupAdmin,
  mapSetupAdminError,
  parseSetupAdminInput,
} from '#/core/setup/index.server';

export const middleware = [rateLimitMiddleware('api-admin')];

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  const fields = parseSetupAdminInput(parsed.body);

  try {
    const result = await createSetupAdmin(parsed.body);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const mapped = mapSetupAdminError(err, fields);
    if (mapped) {
      return Response.json(mapped.body, { status: mapped.status });
    }
    throw err;
  }
}
