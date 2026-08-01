// POST /api/admin/v1/marketing/abandoned-cart-sequences/run
// Queue abandoned-cart sequence processing. Requires admin-scoped API key.

import { requireMethod } from '#/libs/api/admin/index.server';
import { queueAbandonedCartSequence } from '#/core/marketing/job.server';

/**
 * @param {{ request: Request }} args
 * @returns {Promise<Response>}
 */
export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  queueAbandonedCartSequence();
  return Response.json({ queued: true }, { status: 202 });
}
