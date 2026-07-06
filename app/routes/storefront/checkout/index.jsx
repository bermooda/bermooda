import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCartTokenFromRequest } from '#/utils/cart-cookie.server';
import logger from '#/utils/logger.server';
import { getCustomerSession } from '#/libs/auth/customer.server';
import { validateAddress } from '#/core/address-validation/index.server';
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
import { computeTotals } from '#/core/checkout/totals.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { getCustomerLoyaltySummary } from '#/core/loyalty/index.server';
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
import { getCustomerStoreCreditSummary } from '#/core/store-credit/index.server';
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

  const [storeCredit, loyalty] = await Promise.all([
    getCustomerStoreCreditSummary(customerId),
    getCustomerLoyaltySummary(customerId),
  ]);

  return {
    isLoggedIn: true,
    storeCreditBalanceCents: storeCredit.balance,
    loyaltyBalance: loyalty.balance,
    loyaltyEnabled: loyalty.enabled,
    loyaltyValueCents: loyalty.valueCents,
  };
}

function buildCheckoutPayload(rawData, { session, customerId }) {
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

  const useStoreCredit =
    rawData.useStoreCredit === 'on' || rawData.useStoreCredit === 'true';
  const useLoyalty =
    rawData.useLoyalty === 'on' || rawData.useLoyalty === 'true';

  return {
    addr,
    email: rawData.email?.toString().trim() || session?.email || null,
    vatId: rawData.vatId?.toString().trim() || null,
    taxExempt: rawData.taxExempt === 'on' || rawData.taxExempt === 'true',
    couponCode: rawData.couponCode?.toString().trim().toUpperCase() || null,
    shippingOptionId: rawData.shippingOptionId?.toString() || null,
    paymentProvider: rawData.paymentProvider?.toString() || 'stripe',
    giftCardCode: rawData.giftCardCode?.toString().trim().toUpperCase() || null,
    useStoreCredit,
    useLoyalty,
    effectiveCustomerId: session?.customerId ?? customerId ?? undefined,
  };
}

async function resolveTenderAmounts(payload) {
  let storeCreditCents = 0;
  let loyaltyPointsCents = 0;

  if (payload.effectiveCustomerId && payload.useStoreCredit) {
    const storeCredit = await getCustomerStoreCreditSummary(
      payload.effectiveCustomerId
    );
    storeCreditCents = storeCredit.balance;
  }

  if (payload.effectiveCustomerId && payload.useLoyalty) {
    const loyalty = await getCustomerLoyaltySummary(
      payload.effectiveCustomerId
    );
    loyaltyPointsCents = loyalty.valueCents;
  }

  return { storeCreditCents, loyaltyPointsCents };
}

async function buildSessionUpdateData(payload, session) {
  const hasAddress =
    payload.addr.line1 && payload.addr.city && payload.addr.country;

  let normalizedAddr = payload.addr;
  if (hasAddress) {
    try {
      const validation = await validateAddress(payload.addr);
      if (validation.valid) {
        normalizedAddr = validation.normalized ?? payload.addr;
      }
    } catch (err) {
      logger.warn(
        { err },
        'Address validation failed — continuing with raw address'
      );
    }
  }

  let shippingOptionJson = session?.shippingOptionJson ?? null;
  if (payload.shippingOptionId && hasAddress) {
    const cartForQuotes = session?.cart ?? null;
    if (cartForQuotes) {
      const { option } = await resolveShippingOption({
        cart: cartForQuotes,
        shippingAddress: normalizedAddr,
        optionId: payload.shippingOptionId,
      });
      if (option) {
        shippingOptionJson = JSON.stringify(option);
      }
    }
  }

  const { storeCreditCents, loyaltyPointsCents } =
    await resolveTenderAmounts(payload);

  return {
    shippingAddressJson: hasAddress
      ? JSON.stringify(normalizedAddr)
      : undefined,
    billingAddressJson: null,
    email: payload.email,
    vatId: payload.vatId,
    taxExempt: payload.taxExempt,
    couponCode: payload.couponCode,
    shippingOptionJson: shippingOptionJson ?? undefined,
    paymentProvider: payload.paymentProvider,
    giftCardCode: payload.giftCardCode,
    storeCreditCents,
    loyaltyPointsCents,
    normalizedAddr,
    hasAddress,
  };
}

async function loadCheckoutData(request, session, cart, customerId) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const { shippingAddress } = parseCheckoutSessionFields(session);
  const checkoutCart = session?.cart ?? cart;
  const effectiveCustomerId = session?.customerId ?? customerId ?? undefined;

  const [shippingQuotes, paymentProviders, totals, tenderBalances, slotBlocks] =
    await Promise.all([
      shippingAddress
        ? getAllQuotes({ cart: checkoutCart, shippingAddress })
        : Promise.resolve([]),
      Promise.resolve(listProvidersWithDetails()),
      computeTotals(buildComputeTotalsParams(session, checkoutCart)),
      loadTenderBalances(effectiveCustomerId),
      getSlotBlocksMap(['checkout.afterPayment']),
    ]);

  return {
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
  };
}

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
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

  const data = await loadCheckoutData(request, session, cart, customerId);

  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    `checkout_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
  );

  return Response.json({ themeId, ...data }, { headers });
}

export async function action({ request }) {
  const themeId = await preloadStorefrontTheme();
  const formData = await request.formData();
  const sessionId = getCheckoutSessionId(request);
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

  // ── Place order ───────────────────────────────────────────────────────────
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
  } catch (err) {
    logger.error({ err }, 'Failed to prepare checkout session');
    return { error: 'Unable to load shipping options. Please try again.' };
  }

  const validation = await validateAddress(
    JSON.parse(updateData.shippingAddressJson)
  );
  if (!validation.valid) {
    return { error: 'Please check your shipping address.' };
  }

  try {
    await updateCheckoutSession(
      sessionId,
      {
        shippingAddressJson: updateData.shippingAddressJson,
        billingAddressJson: updateData.billingAddressJson,
        email: updateData.email,
        vatId: updateData.vatId,
        taxExempt: updateData.taxExempt,
        couponCode: updateData.couponCode,
        shippingOptionJson: updateData.shippingOptionJson,
        paymentProvider: updateData.paymentProvider,
        giftCardCode: updateData.giftCardCode,
        storeCreditCents: updateData.storeCreditCents,
        loyaltyPointsCents: updateData.loyaltyPointsCents,
      },
      { requireComplete: true }
    );
  } catch (err) {
    return { error: err.message };
  }

  const refreshedSession = await getCheckoutSession(sessionId);
  const cartSnapshot = refreshedSession?.cart ?? session.cart;

  let order;
  try {
    order = await placeOrder(sessionId, {
      paymentProvider:
        refreshedSession?.paymentProvider ?? payload.paymentProvider,
    });
  } catch (err) {
    logger.error({ err }, 'placeOrder failed');
    return { themeId, error: err.message };
  }

  const origin = new URL(request.url).origin;
  const providerId = order.paymentProvider ?? 'stripe';

  if (providerId === 'manual') {
    return redirect(`${origin}/thank-you/${order.orderNumber}`);
  }

  if (order.totalCents <= 0) {
    return redirect(`${origin}/thank-you/${order.orderNumber}`);
  }

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
      logger.error({ err, orderId: order.id }, 'PaymentIntent creation failed');
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
      cancelUrl: `${origin}/checkout`,
    });

    const provider = getPaymentProvider(providerId);
    if (provider.requiresRedirect === false || paymentSession.manual) {
      return redirect(`${origin}/thank-you/${order.orderNumber}`);
    }

    return redirect(paymentSession.url);
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Payment session creation failed');
    return {
      error: 'Payment session creation failed. Please contact support.',
    };
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
