import {
  closePosSession,
  createPosDraftOrder,
  openPosSession,
} from '#/core/pos/index.server';

export async function action({ request }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.intent === 'openSession') {
    const session = await openPosSession({
      staffId: body.staffId,
      locationId: body.locationId,
    });
    return Response.json({ session }, { status: 201 });
  }

  if (body.intent === 'closeSession') {
    const session = await closePosSession(body.sessionId);
    return Response.json({ session });
  }

  if (body.intent === 'createDraftOrder') {
    const order = await createPosDraftOrder({
      posSessionId: body.sessionId,
      currency: body.currency,
      totalCents: body.totalCents,
    });
    return Response.json({ order }, { status: 201 });
  }

  return Response.json({ error: 'Unknown intent' }, { status: 400 });
}
