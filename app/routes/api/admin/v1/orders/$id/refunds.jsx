// POST /api/admin/v1/orders/:id/refunds — create a refund
// Requires admin-scoped API key.

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { createRefund } from '#/core/orders/index.server';

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
    return jsonDomainError(err);
  }
}
