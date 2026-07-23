// POST /api/admin/v1/customers/:id/erase — anonymize customer PII
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { eraseCustomer } from '#/core/gdpr/index.server';

const mapEraseError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  conflict: ['ALREADY_ERASED'],
});

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  try {
    const result = await eraseCustomer(params.id);
    return Response.json(result);
  } catch (err) {
    return mapEraseError(err);
  }
}
