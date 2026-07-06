// POST /api/admin/v1/returns/:id/approve
// POST /api/admin/v1/returns/:id/receive
// POST /api/admin/v1/returns/:id/complete
// POST /api/admin/v1/returns/:id/cancel
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  approveReturn,
  cancelReturn,
  completeReturn,
  parseCompleteReturnInput,
  receiveReturn,
} from '#/core/returns/index.server';

function returnErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'INVALID_REFUND_AMOUNT' ||
    err.code === 'INVALID_RESOLUTION'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const actionName = url.pathname.split('/').pop();

  let body = {};
  try {
    if (request.headers.get('content-length') !== '0') {
      body = await request.json();
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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
    return returnErrorResponse(err);
  }
}
