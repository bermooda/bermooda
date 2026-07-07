// POST /api/admin/v1/orders/:id/refunds — create a refund
// Requires admin-scoped API key.

import { createRefund } from '#/core/orders/index.server';

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

  const { amountCents, reason, providerRefundId } = body;
  if (typeof amountCents !== 'number') {
    return Response.json(
      { error: 'amountCents must be a number' },
      { status: 400 }
    );
  }

  try {
    const refund = await createRefund(params.id, {
      amountCents,
      reason,
      providerRefundId,
    });
    return Response.json({ refund }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
