// GET /api/v1/checkout/:id — get a checkout session

import { getCheckoutSession } from '#/core/checkout/index.server';

export async function loader({ params }) {
  const session = await getCheckoutSession(params.id);
  if (!session) {
    return Response.json(
      { error: 'Checkout session not found' },
      { status: 404 }
    );
  }
  return Response.json({ session });
}
