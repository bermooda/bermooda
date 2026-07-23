// POST /api/admin/v1/orders/:id/returns — create a return request
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  parseRequestReturnInput,
  requestReturn,
} from '#/core/returns/index.server';

const mapReturnError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: ['RETURN_LINES_REQUIRED', 'INVALID_RETURN_LINE'],
});

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    const input = parseRequestReturnInput(body);
    const returnRecord = await requestReturn(params.id, input);
    return Response.json({ return: returnRecord }, { status: 201 });
  } catch (err) {
    return mapReturnError(err);
  }
}
