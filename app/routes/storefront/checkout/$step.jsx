import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCartTokenFromRequest } from '#/utils/cart-cookie.server';
import logger from '#/utils/logger.server';
import { getCustomerSession } from '#/libs/auth/customer.server';

import { validateAddress } from '#/core/address-validation/index.server';
import { getCart } from '#/core/cart/index.server';
import {
  advanceStep,
  buildComputeTotalsParams,
  CHECKOUT_STEPS,
  createCheckoutSession,
  getCheckoutSession,
  isValidCheckoutStep,
  linkCheckoutCustomer,
  normaliseCheckoutSessionForDisplay,
  parseCheckoutSessionFields,
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
  createPaymentIntent,
  createPaymentSession,
  getProvider as getPaymentProvider,
  listProvidersWithDetails,
} from '#/core/payments/index.server';
import {
  getAllQuotes,
  resolveShippingOption,
} from '#/core/shipping/index.server';
import { getStoreCreditBalance } from '#/core/store-credit/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

function getCheckoutSessionId(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)checkout_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
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

  if (!isValidCheckoutStep(step)) {
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

  const stepIndex = CHECKOUT_STEPS.indexOf(step);
  const sessionStepIndex = CHECKOUT_STEPS.indexOf(session.step ?? 'address');

  if (stepIndex > sessionStepIndex) {
    return redirect(`/checkout/${session.step ?? 'address'}`);
  }

  const checkoutCart = session.cart ?? cart;
  const { shippingAddress } = parseCheckoutSessionFields(session);

  // Shipping quotes: needed on shipping step and review step (for recap)
  const needsQuotes = step === 'shipping' || step === 'review';

  const needsTenderBalances = step === 'payment' || step === 'review';
  const effectiveCustomerId = session.customerId ?? customerId ?? undefined;

  const [shippingQuotes, paymentProviders, totals, tenderBalances, slotBlocks] =
    await Promise.all([
      needsQuotes && shippingAddress
        ? getAllQuotes({ cart: checkoutCart, shippingAddress })
        : Promise.resolve([]),
      Promise.resolve(listProvidersWithDetails()),
      step === 'review' || step === 'payment'
        ? computeTotals(buildComputeTotalsParams(session, checkoutCart))
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
      session: normaliseCheckoutSessionForDisplay(session),
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
  const themeId = await preloadStorefrontTheme();
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
        const intent = await createPaymentIntent(providerId, {
          amountCents: order.totalCents,
          currency: order.currency,
          orderId: order.id,
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
        amountCents: order.totalCents,
        currency: order.currency,
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
    const shippingOptionId = rawData.shippingOptionId?.toString();
    if (!shippingOptionId) {
      return { error: 'Please select a shipping method.' };
    }

    const session = await getCheckoutSession(sessionId);
    const { shippingAddress: shippingAddr } =
      parseCheckoutSessionFields(session);
    const cartForQuotes = session?.cart ?? null;

    if (!cartForQuotes || !shippingAddr) {
      return { error: 'Please complete your shipping address first.' };
    }

    try {
      const { option } = await resolveShippingOption({
        cart: cartForQuotes,
        shippingAddress: shippingAddr,
        optionId: shippingOptionId,
      });

      if (!option) {
        return {
          error: 'The selected shipping method is no longer available.',
        };
      }

      stepData = {
        shippingOptionId,
        shippingOptionJson: JSON.stringify(option),
      };
    } catch (err) {
      logger.error(
        { err },
        'Failed to fetch shipping quotes during shipping step'
      );
      return { error: 'Unable to load shipping options. Please try again.' };
    }
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

  const currentIndex = CHECKOUT_STEPS.indexOf(step);
  const nextStep = CHECKOUT_STEPS[currentIndex + 1];

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
