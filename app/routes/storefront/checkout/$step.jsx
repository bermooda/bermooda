import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import logger from '#/utils/logger.server';

import { validateAddress } from '#/core/address-validation/index.server';
import { getCart } from '#/core/cart/index.server';
import {
  advanceStep,
  createCheckoutSession,
  getCheckoutSession,
} from '#/core/checkout/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { placeOrder } from '#/core/orders/index.server';
import {
  createCheckoutSession as createPaymentSession,
  getProvider as getPaymentProvider,
  listProvidersWithDetails,
} from '#/core/payments/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { computeTotals } from '#/core/checkout/totals.server';
import CheckoutLayout from '#/themes/default/components/checkout-layout';

const VALID_STEPS = ['address', 'shipping', 'payment', 'review'];

function getCartToken(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)cart_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

function getCheckoutSessionId(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)checkout_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Parse JSON session fields into their object forms so theme components
 * can access them without knowing the raw field names.
 */
function normaliseSession(session) {
  if (!session) return session;

  const shippingAddress = session.shippingAddressJson
    ? JSON.parse(session.shippingAddressJson)
    : null;

  const billingAddress = session.billingAddressJson
    ? JSON.parse(session.billingAddressJson)
    : null;

  const shippingOption = session.shippingOptionJson
    ? JSON.parse(session.shippingOptionJson)
    : null;

  return {
    ...session,
    shippingAddress,
    billingAddress,
    shippingOption,
    shippingOptionId: shippingOption?.id ?? null,
  };
}

export async function loader({ request, params }) {
  const { step } = params;

  if (!VALID_STEPS.includes(step)) {
    throw new Response('Invalid checkout step', { status: 404 });
  }

  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const cartToken = getCartToken(request);

  if (!cartToken) return redirect('/cart');

  const cart = await getCart(cartToken);
  if (!cart || !cart.lines?.length) return redirect('/cart');

  let sessionId = getCheckoutSessionId(request);
  let session = sessionId ? await getCheckoutSession(sessionId) : null;

  if (!session) {
    session = await createCheckoutSession(cart.id);
    sessionId = session.id;
  }

  const stepIndex = VALID_STEPS.indexOf(step);
  const sessionStepIndex = VALID_STEPS.indexOf(session.step ?? 'address');

  if (stepIndex > sessionStepIndex) {
    return redirect(`/checkout/${session.step ?? 'address'}`);
  }

  // Parse the shipping address from the session for quote fetching
  const shippingAddress = session.shippingAddressJson
    ? JSON.parse(session.shippingAddressJson)
    : null;

  // Shipping quotes: needed on shipping step and review step (for recap)
  const needsQuotes = step === 'shipping' || step === 'review';

  const [shippingQuotes, paymentProviders, totals] = await Promise.all([
    needsQuotes && shippingAddress
      ? getAllQuotes({ cart, shippingAddress })
      : Promise.resolve([]),
    Promise.resolve(listProvidersWithDetails()),
    step === 'review' || step === 'payment'
      ? computeTotals({
          cart,
          cartId: cart.id,
          shippingAddress,
          couponCode: session.couponCode ?? undefined,
          shippingOptionId: session.shippingOptionJson
            ? JSON.parse(session.shippingOptionJson)?.id
            : undefined,
          taxExempt: session.taxExempt ?? false,
          vatId: session.vatId ?? undefined,
        })
      : Promise.resolve(null),
  ]);

  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    `checkout_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
  );

  return Response.json(
    {
      step,
      session: normaliseSession(session),
      cart,
      shippingQuotes,
      paymentProviders,
      totals,
      locale,
      currency,
    },
    { headers }
  );
}

export async function action({ request, params }) {
  const { step } = params;
  const formData = await request.formData();
  const sessionId = getCheckoutSessionId(request);

  if (!sessionId) return redirect('/cart');

  const rawData = Object.fromEntries(formData);

  // ── Review step: place the order then redirect to the payment provider ────
  if (step === 'review') {
    // Fetch the session (with cart lines) before placeOrder clears the cart
    const session = await getCheckoutSession(sessionId);
    if (!session) return redirect('/cart');

    // Keep a reference to the cart so we can build the Stripe line items even
    // after placeOrder() deletes the cart lines.
    const cartSnapshot = session.cart;

    let order;
    try {
      order = await placeOrder(sessionId, {
        paymentProvider: session.paymentProvider ?? 'stripe',
      });
    } catch (err) {
      logger.error({ err }, 'placeOrder failed at review step');
      return { error: err.message };
    }

    const origin = new URL(request.url).origin;
    const providerId = order.paymentProvider ?? 'stripe';

    // Manual/offline payment — no redirect; order stays pending_payment
    if (providerId === 'manual') {
      return redirect(`${origin}/thank-you/${order.orderNumber}`);
    }

    try {
      const paymentSession = await createPaymentSession(providerId, {
        cart: cartSnapshot,
        orderId: order.id,
        successUrl: `${origin}/thank-you/${order.orderNumber}`,
        cancelUrl: `${origin}/checkout/review`,
      });

      const provider = getPaymentProvider(providerId);
      if (provider.requiresRedirect === false || paymentSession.manual) {
        return redirect(`${origin}/thank-you/${order.orderNumber}`);
      }

      return redirect(paymentSession.url);
    } catch (err) {
      logger.error(
        { err, orderId: order.id },
        'Payment session creation failed'
      );
      // Order is placed but payment session failed — surface the error so the
      // operator can manually process. Admin can cancel the order if needed.
      return {
        error: 'Payment session creation failed. Please contact support.',
      };
    }
  }

  // ── Address step: serialize individual form fields into JSON ──────────────
  let stepData;

  if (step === 'address') {
    const addr = {
      firstName: rawData.firstName ?? '',
      lastName: rawData.lastName ?? '',
      line1: rawData.line1 ?? '',
      line2: rawData.line2 || null,
      city: rawData.city ?? '',
      state: rawData.state || null,
      postalCode: rawData.postalCode || null,
      country: rawData.country ?? '',
      phone: rawData.phone || null,
    };

    let normalizedAddr = addr;
    try {
      const validation = await validateAddress(addr);
      if (!validation.valid) {
        return { error: 'Please check your shipping address.' };
      }
      normalizedAddr = validation.normalized ?? addr;
    } catch (err) {
      logger.warn({ err }, 'Address validation failed — continuing with raw address');
    }

    stepData = {
      shippingAddressJson: JSON.stringify(normalizedAddr),
      billingAddressJson: rawData.billingAddressJson ?? null,
      email: rawData.email || null,
      vatId: rawData.vatId?.toString().trim() || null,
      taxExempt: rawData.taxExempt === 'on' || rawData.taxExempt === 'true',
      couponCode: rawData.couponCode?.toString().trim().toUpperCase() || null,
    };
  } else if (step === 'shipping') {
    // Look up the full shipping option so we can persist it as JSON
    const session = await getCheckoutSession(sessionId);
    const cartForQuotes = session?.cart ?? null;
    const shippingAddr = session?.shippingAddressJson
      ? JSON.parse(session.shippingAddressJson)
      : null;

    let shippingOptionJson = null;
    if (cartForQuotes && shippingAddr && rawData.shippingOptionId) {
      try {
        const quotes = await getAllQuotes({
          cart: cartForQuotes,
          shippingAddress: shippingAddr,
        });
        const selected = quotes.find((q) => q.id === rawData.shippingOptionId);
        if (selected) {
          shippingOptionJson = JSON.stringify(selected);
        }
      } catch (err) {
        logger.error(
          { err },
          'Failed to fetch shipping quotes during shipping step'
        );
      }
    }

    stepData = {
      shippingOptionId: rawData.shippingOptionId,
      shippingOptionJson,
    };
  } else if (step === 'payment') {
    stepData = {
      paymentProvider: rawData.paymentProvider ?? 'stripe',
    };
  } else {
    stepData = rawData;
  }

  try {
    await advanceStep(sessionId, stepData);
  } catch (err) {
    return { error: err.message };
  }

  const currentIndex = VALID_STEPS.indexOf(step);
  const nextStep = VALID_STEPS[currentIndex + 1];

  return nextStep
    ? redirect(`/checkout/${nextStep}`)
    : redirect(`/checkout/${step}`);
}

export function meta({ data }) {
  const labels = {
    address: 'Shipping Address',
    shipping: 'Shipping Method',
    payment: 'Payment',
    review: 'Review Order',
  };
  const title = labels[data?.step] ?? 'Checkout';
  return [{ title }];
}

export default function CheckoutRoute() {
  const data = useLoaderData();
  return <CheckoutLayout {...data} />;
}
