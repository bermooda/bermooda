import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCartTokenFromRequest } from '#/utils/cart-cookie.server';
import logger from '#/utils/logger.server';
import { getCustomerSession } from '#/libs/auth/customer.server';

import { validateAddress } from '#/core/address-validation/index.server';
import { getCart } from '#/core/cart/index.server';
import {
  advanceStep,
  createCheckoutSession,
  getCheckoutSession,
  linkCheckoutCustomer,
} from '#/core/checkout/index.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  getLoyaltyBalance,
  getLoyaltyConfig,
  pointsToCents,
} from '#/core/loyalty/index.server';
import { attachPaymentIntent, placeOrder } from '#/core/orders/index.server';
import {
  createCheckoutSession as createPaymentSession,
  createPaymentIntent,
  getProvider as getPaymentProvider,
  listProvidersWithDetails,
} from '#/core/payments/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { getStoreCreditBalance } from '#/core/store-credit/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

const VALID_STEPS = ['address', 'shipping', 'payment', 'review'];

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

function buildTotalsParams(session, cart, shippingAddress) {
  const shippingOption = session.shippingOptionJson
    ? JSON.parse(session.shippingOptionJson)
    : null;

  return {
    cart,
    cartId: cart.id,
    shippingAddress,
    couponCode: session.couponCode ?? undefined,
    shippingOptionId: shippingOption?.id ?? undefined,
    taxExempt: session.taxExempt ?? false,
    vatId: session.vatId ?? undefined,
    customerId: session.customerId ?? undefined,
    giftCardCode: session.giftCardCode ?? undefined,
    storeCreditCents: session.storeCreditCents ?? 0,
    loyaltyPointsCents: session.loyaltyPointsCents ?? 0,
    salesChannelId: session.salesChannelId ?? undefined,
  };
}

async function loadTenderBalances(customerId) {
  if (!customerId) {
    return { isLoggedIn: false };
  }

  const [storeCreditBalanceCents, loyaltyBalance, loyaltyConfig] =
    await Promise.all([
      getStoreCreditBalance(customerId),
      getLoyaltyBalance(customerId),
      getLoyaltyConfig(),
    ]);

  return {
    isLoggedIn: true,
    storeCreditBalanceCents,
    loyaltyBalance,
    loyaltyEnabled: loyaltyConfig.enabled,
    loyaltyValueCents: pointsToCents(
      loyaltyBalance,
      loyaltyConfig.redemptionRateCents
    ),
  };
}

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const { step } = params;

  if (!VALID_STEPS.includes(step)) {
    throw new Response('Invalid checkout step', { status: 404 });
  }

  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const cartToken = getCartTokenFromRequest(request);
  const customerAuth = await getCustomerSession(request);
  const customerId = customerAuth?.user?.id ?? undefined;

  if (!cartToken) return redirect('/cart');

  const cart = await getCart(cartToken);
  if (!cart || !cart.lines?.length) return redirect('/cart');

  let sessionId = getCheckoutSessionId(request);
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

  const needsTenderBalances = step === 'payment' || step === 'review';
  const effectiveCustomerId = session.customerId ?? customerId ?? undefined;

  const [shippingQuotes, paymentProviders, totals, tenderBalances, slotBlocks] =
    await Promise.all([
      needsQuotes && shippingAddress
        ? getAllQuotes({ cart, shippingAddress })
        : Promise.resolve([]),
      Promise.resolve(listProvidersWithDetails()),
      step === 'review' || step === 'payment'
        ? computeTotals(buildTotalsParams(session, cart, shippingAddress))
        : Promise.resolve(null),
      needsTenderBalances
        ? loadTenderBalances(effectiveCustomerId)
        : Promise.resolve(null),
      step === 'payment'
        ? getSlotBlocksMap(['checkout.afterPayment'])
        : Promise.resolve({}),
    ]);

  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    `checkout_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
  );

  return Response.json(
    {
      themeId,
      step,
      session: normaliseSession(session),
      cart,
      shippingQuotes,
      paymentProviders,
      totals,
      tenderBalances,
      locale,
      currency,
      slotBlocks,
      stripePublishableKey: process.env.STRIPE_PUBLIC_KEY ?? null,
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
      return {
        themeId,
        error: err.message,
      };
    }

    const origin = new URL(request.url).origin;
    const providerId = order.paymentProvider ?? 'stripe';

    // Manual/offline payment — no redirect; order stays pending_payment
    if (providerId === 'manual') {
      return redirect(`${origin}/thank-you/${order.orderNumber}`);
    }

    // Zero-balance orders (gift card / store credit covers total)
    if (order.totalCents <= 0) {
      return redirect(`${origin}/thank-you/${order.orderNumber}`);
    }

    // Stripe Payment Element — return client secret for embedded checkout
    if (providerId === 'stripe_element') {
      try {
        const intent = await createPaymentIntent('stripe', {
          amountCents: order.totalCents,
          currency: order.currency,
          orderId: order.id,
          customerId: session.customerId ?? undefined,
        });

        await attachPaymentIntent(order.id, intent.paymentIntentId);

        return {
          themeId,
          paymentElement: {
            clientSecret: intent.clientSecret,
            orderNumber: order.orderNumber,
            publishableKey: process.env.STRIPE_PUBLIC_KEY ?? null,
          },
        };
      } catch (err) {
        logger.error(
          { err, orderId: order.id },
          'PaymentIntent creation failed'
        );
        return {
          error:
            'Payment setup failed. Your order was placed — please contact support.',
        };
      }
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
      logger.warn(
        { err },
        'Address validation failed — continuing with raw address'
      );
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
    const session = await getCheckoutSession(sessionId);
    const useStoreCredit =
      rawData.useStoreCredit === 'on' || rawData.useStoreCredit === 'true';
    const useLoyalty =
      rawData.useLoyalty === 'on' || rawData.useLoyalty === 'true';

    let storeCreditCents = 0;
    let loyaltyPointsCents = 0;

    if (session?.customerId && useStoreCredit) {
      storeCreditCents = await getStoreCreditBalance(session.customerId);
    }

    if (session?.customerId && useLoyalty) {
      const loyaltyConfig = await getLoyaltyConfig();
      if (loyaltyConfig.enabled) {
        const balance = await getLoyaltyBalance(session.customerId);
        loyaltyPointsCents = pointsToCents(
          balance,
          loyaltyConfig.redemptionRateCents
        );
      }
    }

    stepData = {
      paymentProvider: rawData.paymentProvider ?? 'stripe',
      giftCardCode:
        rawData.giftCardCode?.toString().trim().toUpperCase() || null,
      storeCreditCents,
      loyaltyPointsCents,
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

export function meta({ loaderData }) {
  const labels = {
    address: 'Shipping Address',
    shipping: 'Shipping Method',
    payment: 'Payment',
    review: 'Review Order',
  };
  const title = labels[loaderData?.step] ?? 'Checkout';
  return [{ title }];
}

export default function CheckoutRoute() {
  const { themeId, ...data } = useLoaderData();
  const CheckoutLayout = getStorefrontComponent('CheckoutLayout', themeId);
  if (!CheckoutLayout)
    throw new Error('CheckoutLayout theme component not found');
  return <CheckoutLayout {...data} />;
}
