// POST /api/v1/checkout/:id/update — persist checkout session fields

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public/index.server';
import {
  normalizeAddressForSession,
  parseAddressJson,
} from '#/core/address-validation/index.server';
import { updateCheckoutSession } from '#/core/checkout/index.server';

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  let body = parsed.body;

  try {
    if (body.shippingAddressJson) {
      const addr = parseAddressJson(body.shippingAddressJson);
      if (addr) {
        const { normalizedAddr } = await normalizeAddressForSession(addr);
        body = { ...body, shippingAddressJson: JSON.stringify(normalizedAddr) };
      }
    }

    const session = await updateCheckoutSession(params.id, body, {
      requireComplete: Boolean(
        body.shippingAddressJson &&
        body.shippingOptionJson &&
        body.paymentProvider
      ),
    });
    return Response.json({ session });
  } catch (err) {
    return jsonDomainError(err);
  }
}
