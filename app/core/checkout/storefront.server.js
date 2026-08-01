// Storefront checkout orchestration — shared by the /checkout route.

import {
  normalizeAddressForSession,
  parseAddressInput,
} from '#/core/address-validation/index.server';
import {
  buildComputeTotalsParams,
  getCheckoutSession,
  parseCheckoutSessionFields,
  normaliseCheckoutSessionForDisplay,
  updateCheckoutSession,
} from '#/core/checkout/index.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { getCustomerLoyaltySummary } from '#/core/loyalty/index.server';
import {
  attachPaymentIntent,
  placeOrder,
} from '#/core/orders/place.server';
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

/**
 * @param {Record<string, unknown>} rawData
 * @param {{ session?: object|null, customerId?: string }} context
 */
export function buildCheckoutPayload(rawData, { session, customerId }) {
  const addr = parseAddressInput(rawData);

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

/**
 * @param {ReturnType<typeof buildCheckoutPayload>} payload
 * @param {object} session
 */
export async function buildSessionUpdateData(payload, session) {
  const { normalizedAddr, hasAddress } = await normalizeAddressForSession(
    payload.addr
  );

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

/**
 * @param {Request} request
 * @param {object} session
 * @param {object} cart
 * @param {string|undefined} customerId
 */
export async function loadCheckoutDisplayData(
  request,
  session,
  cart,
  customerId
) {
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

/**
 * Persist checkout session fields required before placing an order.
 *
 * @param {string} sessionId
 * @param {Awaited<ReturnType<typeof buildSessionUpdateData>>} updateData
 */
export async function persistCheckoutSessionForPlaceOrder(
  sessionId,
  updateData
) {
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
}

/**
 * Place order and resolve payment redirect / inline element payload.
 *
 * @param {{
 *   sessionId: string,
 *   session: object,
 *   payload: ReturnType<typeof buildCheckoutPayload>,
 *   request: Request,
 * }} input
 */
export async function resolveCheckoutPlaceOrderResult({
  sessionId,
  session,
  payload,
  request,
}) {
  const refreshedSession = await getCheckoutSession(sessionId);
  const cartSnapshot = refreshedSession?.cart ?? session.cart;

  const order = await placeOrder(sessionId, {
    paymentProvider:
      refreshedSession?.paymentProvider ?? payload.paymentProvider,
  });

  const origin = new URL(request.url).origin;
  const providerId = order.paymentProvider ?? 'stripe';

  if (providerId === 'manual' || order.totalCents <= 0) {
    return {
      type: 'redirect',
      url: `${origin}/thank-you/${order.orderNumber}`,
    };
  }

  if (providerId === 'stripe_element') {
    const intent = await createPaymentIntent(providerId, {
      amountCents: order.totalCents,
      currency: order.currency,
      orderId: order.id,
    });

    await attachPaymentIntent(order.id, intent.paymentIntentId);

    return {
      type: 'payment-element',
      paymentElement: {
        clientSecret: intent.clientSecret,
        orderNumber: order.orderNumber,
        publishableKey: process.env.STRIPE_PUBLIC_KEY ?? null,
      },
    };
  }

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
    return {
      type: 'redirect',
      url: `${origin}/thank-you/${order.orderNumber}`,
    };
  }

  return { type: 'redirect', url: paymentSession.url };
}
