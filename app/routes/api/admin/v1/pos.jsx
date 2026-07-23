// GET /api/admin/v1/pos — list POS sessions
// POST /api/admin/v1/pos — open/close session or create draft order
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
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

const mapPosError = createDomainErrorMapper({
  notFound: ['NOT_FOUND', 'LOCATION_NOT_FOUND'],
  badRequest: [
    'STAFF_ID_REQUIRED',
    'SESSION_ID_REQUIRED',
    'INVALID_TOTAL_CENTS',
    'CURRENCY_REQUIRED',
    'INVALID_POS_SESSION_STATUS',
  ],
  conflict: ['SESSION_NOT_OPEN', 'SESSION_ALREADY_OPEN'],
});

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
    return mapPosError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
    return mapPosError(err);
  }
}
