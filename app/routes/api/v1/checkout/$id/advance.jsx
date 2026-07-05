// POST /api/v1/checkout/:id/advance — update checkout session fields

import { updateCheckoutSession } from '#/core/checkout/index.server';

export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let stepData;
  try {
    stepData = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const session = await updateCheckoutSession(params.id, stepData, {
      requireComplete: Boolean(
        stepData.shippingAddressJson &&
        stepData.shippingOptionJson &&
        stepData.paymentProvider
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
