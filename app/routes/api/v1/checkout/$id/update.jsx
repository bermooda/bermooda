// POST /api/v1/checkout/:id/update — persist checkout session fields

import { updateCheckoutSession } from '#/core/checkout/index.server';

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
    const session = await updateCheckoutSession(params.id, body, {
      requireComplete: Boolean(
        body.shippingAddressJson &&
        body.shippingOptionJson &&
        body.paymentProvider
      ),
    });
    return Response.json({ session });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
