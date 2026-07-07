import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCartTokenFromRequest } from '#/utils/cart-cookie.server';
import {
  appendCheckoutSessionCookie,
  getCheckoutSessionIdFromRequest,
} from '#/utils/checkout-cookie.server';
import { getCustomerSession } from '#/libs/auth/customer.server';
import { handleError } from '#/libs/error.server';
import { normalizeAddressForSession } from '#/core/address-validation/index.server';
import { getCart } from '#/core/cart/index.server';
import {
  buildComputeTotalsParams,
  createCheckoutSession,
  getCheckoutSession,
  linkCheckoutCustomer,
  normaliseCheckoutSessionForDisplay,
  parseCheckoutSessionFields,
  updateCheckoutSession,
} from '#/core/checkout/index.server';
import {
  buildCheckoutPayload,
  buildSessionUpdateData,
  loadCheckoutDisplayData,
  persistCheckoutSessionForPlaceOrder,
  resolveCheckoutPlaceOrderResult,
} from '#/core/checkout/storefront.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const cartToken = getCartTokenFromRequest(request);
  const customerAuth = await getCustomerSession(request);
  const customerId = customerAuth?.user?.id ?? undefined;

  if (!cartToken) return redirect('/cart');

  const cart = await getCart(cartToken);
  if (!cart || !cart.lines?.length) return redirect('/cart');

  let sessionId = getCheckoutSessionIdFromRequest(request);
  let session = sessionId ? await getCheckoutSession(sessionId) : null;

  if (!session) {
    session = await createCheckoutSession(cart.id, {
      customerId: customerId ?? cart.customerId ?? undefined,
      email: customerAuth?.user?.email ?? undefined,
    });
    sessionId = session.id;
  } else if (customerId && !session.customerId) {
    await linkCheckoutCustomer(sessionId, customerId);
    session = { ...session, customerId };
  }

  const data = await loadCheckoutDisplayData(
    request,
    session,
    cart,
    customerId
  );

  const headers = new Headers();
  appendCheckoutSessionCookie(headers, sessionId);

  return Response.json({ themeId, ...data }, { headers });
}

export async function action({ request }) {
  const themeId = await preloadStorefrontTheme();
  const formData = await request.formData();
  const sessionId = getCheckoutSessionIdFromRequest(request);
  const intent = formData.get('intent')?.toString() ?? 'place-order';
  const rawData = Object.fromEntries(formData);

  if (!sessionId) return redirect('/cart');

  const session = await getCheckoutSession(sessionId);
  if (!session) return redirect('/cart');

  const customerAuth = await getCustomerSession(request);
  const customerId = customerAuth?.user?.id ?? undefined;
  const payload = buildCheckoutPayload(rawData, { session, customerId });

  if (intent === 'update') {
    try {
      const updateData = await buildSessionUpdateData(payload, session);
      const updated = await updateCheckoutSession(sessionId, updateData);
      const { shippingAddress } = parseCheckoutSessionFields(updated);
      const checkoutCart = updated.cart ?? session.cart;

      const [shippingQuotes, totals] = await Promise.all([
        shippingAddress
          ? getAllQuotes({ cart: checkoutCart, shippingAddress })
          : Promise.resolve([]),
        Promise.resolve(
          updated.totals ??
            computeTotals(buildComputeTotalsParams(updated, checkoutCart))
        ),
      ]);

      return {
        intent: 'update',
        session: normaliseCheckoutSessionForDisplay(updated),
        shippingQuotes,
        totals,
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (!payload.shippingOptionId) {
    return { error: 'Please select a shipping method.' };
  }

  let updateData;
  try {
    updateData = await buildSessionUpdateData(payload, session);
    if (!updateData.hasAddress) {
      return { error: 'Please check your shipping address.' };
    }
    if (!updateData.shippingOptionJson) {
      return {
        error: 'The selected shipping method is no longer available.',
      };
    }

    await normalizeAddressForSession(
      JSON.parse(updateData.shippingAddressJson),
      { strict: true }
    );
  } catch (err) {
    if (err.message === 'Please check your shipping address.') {
      return { error: err.message };
    }
    return handleError(err, {
      source: 'storefront.checkout',
      userMessage: 'Unable to load shipping options. Please try again.',
    });
  }

  try {
    await persistCheckoutSessionForPlaceOrder(sessionId, updateData);
  } catch (err) {
    return { error: err.message };
  }

  try {
    const result = await resolveCheckoutPlaceOrderResult({
      sessionId,
      session,
      payload,
      request,
    });

    if (result.type === 'redirect') {
      return redirect(result.url);
    }

    return {
      themeId,
      paymentElement: result.paymentElement,
    };
  } catch (err) {
    return handleError(err, {
      source: 'storefront.checkout.placeOrder',
      userMessage:
        'Payment setup failed. Your order may have been placed — please contact support.',
    });
  }
}

export function meta() {
  return [{ title: 'Checkout' }];
}

export default function CheckoutRoute() {
  const { themeId, ...data } = useLoaderData();
  const CheckoutLayout = getStorefrontComponent('CheckoutLayout', themeId);
  if (!CheckoutLayout)
    throw new Error('CheckoutLayout theme component not found');
  return <CheckoutLayout {...data} />;
}
