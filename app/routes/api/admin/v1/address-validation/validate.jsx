// POST /api/admin/v1/address-validation/validate

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  parseValidatedAddressInput,
  validateAddress,
} from '#/core/address-validation/index.server';

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const address = parseValidatedAddressInput(parsed.body);
    const result = await validateAddress(address);
    return Response.json({ validation: result });
  } catch (err) {
    return jsonDomainError(err, { defaultStatus: 422 });
  }
}
