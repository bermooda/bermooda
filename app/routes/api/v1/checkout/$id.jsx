// GET /api/v1/checkout/:id — get a checkout session

import { getCheckoutSession } from '#/core/checkout/index.server';

export async function loader({ params }) {
  try {
    const session = await getCheckoutSession(params.id);
    return Response.json({ session });
  } catch {
    return Response.json(
      { error: 'Checkout session not found' },
      { status: 404 }
    );
  }
}
