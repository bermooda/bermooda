// GET /api/admin/v1/customers/:id/consent — consent summary
// PATCH /api/admin/v1/customers/:id/consent — update consent
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  getCustomerConsentSummary,
  parseUpdateConsentInput,
  updateCustomerConsent,
} from '#/core/gdpr/index.server';

const mapGdprError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const summary = await getCustomerConsentSummary(params.id);
    return Response.json(summary);
  } catch (err) {
    return mapGdprError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
    return mapGdprError(err);
  }
}
