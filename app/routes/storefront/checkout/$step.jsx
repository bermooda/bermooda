import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCart } from '#/core/cart/index.server';
import {
  createCheckoutSession,
  getCheckoutSession,
  advanceStep,
} from '#/core/checkout/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { listProviders } from '#/core/payments/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
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
    session = await createCheckoutSession({ cartId: cart.id, currency });
    sessionId = session.id;
  }

  const stepIndex = VALID_STEPS.indexOf(step);
  const sessionStepIndex = VALID_STEPS.indexOf(session.step ?? 'address');

  if (stepIndex > sessionStepIndex) {
    return redirect(`/checkout/${session.step ?? 'address'}`);
  }

  // Shipping quotes need cart + address; only available on shipping step+
  const shippingAddress =
    typeof session.shippingAddress === 'string'
      ? JSON.parse(session.shippingAddress)
      : (session.shippingAddress ?? null);

  const [shippingQuotes, paymentProviders] = await Promise.all([
    step === 'shipping' && shippingAddress
      ? getAllQuotes({ cart, shippingAddress })
      : Promise.resolve([]),
    listProviders(),
  ]);

  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    `checkout_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
  );

  return Response.json(
    {
      step,
      session,
      cart,
      shippingQuotes,
      paymentProviders,
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

  const stepData = Object.fromEntries(formData);

  try {
    await advanceStep(sessionId, stepData);
  } catch (err) {
    return { error: err.message };
  }

  const currentIndex = VALID_STEPS.indexOf(step);
  const nextStep = VALID_STEPS[currentIndex + 1];

  return nextStep
    ? redirect(`/checkout/${nextStep}`)
    : redirect('/checkout/review');
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
