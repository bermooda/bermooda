// POST /api/admin/v1/orders/:id/returns — create a return request
// Requires admin-scoped API key.

import {
  parseRequestReturnInput,
  requestReturn,
} from '#/core/returns/index.server';

function returnErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'RETURN_LINES_REQUIRED' ||
    err.code === 'INVALID_RETURN_LINE'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const input = parseRequestReturnInput(body);
    const returnRecord = await requestReturn(params.id, input);
    return Response.json({ return: returnRecord }, { status: 201 });
  } catch (err) {
    return returnErrorResponse(err);
  }
}
