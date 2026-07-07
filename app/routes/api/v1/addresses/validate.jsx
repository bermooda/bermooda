// POST /api/v1/addresses/validate — validate a shipping address

import {
  hasMinimumAddressFields,
  validateAddress,
} from '#/core/address-validation/index.server';

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const address = body.address ?? body;
  if (!hasMinimumAddressFields(address)) {
    return Response.json(
      { error: 'Address must include line1, city, and country' },
      { status: 400 }
    );
  }

  try {
    const result = await validateAddress(address);
    return Response.json({ validation: result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 422 });
  }
}
