// POST /api/admin/v1/returns/:id/approve
// POST /api/admin/v1/returns/:id/receive
// POST /api/admin/v1/returns/:id/complete
// POST /api/admin/v1/returns/:id/cancel
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseOptionalJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  approveReturn,
  cancelReturn,
  completeReturn,
  parseCompleteReturnInput,
  receiveReturn,
} from '#/core/returns/index.server';

const mapReturnError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: ['INVALID_REFUND_AMOUNT', 'INVALID_RESOLUTION'],
});

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const url = new URL(request.url);
  const actionName = url.pathname.split('/').pop();

  const parsed = await parseOptionalJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    if (actionName === 'approve') {
      const returnRecord = await approveReturn(params.id, {
        resolution: body.resolution,
      });
      return Response.json({ return: returnRecord });
    }

    if (actionName === 'receive') {
      const returnRecord = await receiveReturn(params.id);
      return Response.json({ return: returnRecord });
    }

    if (actionName === 'complete') {
      const options = parseCompleteReturnInput(body);
      const returnRecord = await completeReturn(params.id, options);
      return Response.json({ return: returnRecord });
    }

    if (actionName === 'cancel') {
      const returnRecord = await cancelReturn(params.id);
      return Response.json({ return: returnRecord });
    }

    return Response.json({ error: 'Unknown action' }, { status: 404 });
  } catch (err) {
    return mapReturnError(err);
  }
}
