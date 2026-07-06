// GET /api/admin/v1/customers/:id/consent — consent summary
// PATCH /api/admin/v1/customers/:id/consent — update consent
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getCustomerConsentSummary,
  parseUpdateConsentInput,
  updateCustomerConsent,
} from '#/core/gdpr/index.server';

function gdprErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json({ error: err.message }, { status: 404 });
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const summary = await getCustomerConsentSummary(params.id);
    return Response.json(summary);
  } catch (err) {
    return gdprErrorResponse(err);
  }
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = parseUpdateConsentInput(body);
  if (input.analytics === undefined && input.marketing === undefined) {
    return Response.json(
      { error: 'Provide analytics and/or marketing consent flags.' },
      { status: 400 }
    );
  }

  try {
    const consent = await updateCustomerConsent(params.id, input);
    return Response.json({ customerId: params.id, consent });
  } catch (err) {
    return gdprErrorResponse(err);
  }
}
