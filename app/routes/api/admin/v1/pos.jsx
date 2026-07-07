// GET /api/admin/v1/pos — list POS sessions
// POST /api/admin/v1/pos — open/close session or create draft order
// Requires admin-scoped API key.

import {
  closePosSession,
  createPosDraftOrder,
  listPosSessions,
  openPosSession,
  parseCloseSessionInput,
  parseCreateDraftOrderInput,
  parseOpenSessionInput,
  parseSessionListParams,
  POS_ORDER_STATUSES,
  POS_SESSION_STATUSES,
} from '#/core/pos/index.server';

function posErrorResponse(err) {
  if (err.code === 'NOT_FOUND' || err.code === 'LOCATION_NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'STAFF_ID_REQUIRED' ||
    err.code === 'SESSION_ID_REQUIRED' ||
    err.code === 'INVALID_TOTAL_CENTS' ||
    err.code === 'CURRENCY_REQUIRED' ||
    err.code === 'INVALID_POS_SESSION_STATUS'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  if (err.code === 'SESSION_NOT_OPEN' || err.code === 'SESSION_ALREADY_OPEN') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 409 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseSessionListParams(url.searchParams);
    const result = await listPosSessions(params);
    return Response.json({
      ...result,
      posSessionStatuses: POS_SESSION_STATUSES,
      posOrderStatuses: POS_ORDER_STATUSES,
    });
  } catch (err) {
    return posErrorResponse(err);
  }
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.intent === 'openSession') {
      parseOpenSessionInput(body);
      const session = await openPosSession(body);
      return Response.json({ session }, { status: 201 });
    }

    if (body.intent === 'closeSession') {
      const input = parseCloseSessionInput(body);
      const session = await closePosSession(input);
      return Response.json({ session });
    }

    if (body.intent === 'createDraftOrder') {
      const input = parseCreateDraftOrderInput(body);
      const order = await createPosDraftOrder(input);
      return Response.json({ order }, { status: 201 });
    }

    return Response.json({ error: 'Unknown intent' }, { status: 400 });
  } catch (err) {
    return posErrorResponse(err);
  }
}
