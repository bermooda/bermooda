// app/core/checkout/totals.server.js
// Totals engine: subtotal, multi-discount, shipping, tax-class-aware tax, total.

import { summarizeCartLines } from '#/core/cart/lines';
import { resolvePromotions } from '#/core/discounts/index.server';
import { resolveGiftCardRedemption } from '#/core/gift-cards/index.server';
import { resolveLoyaltyRedemption } from '#/core/loyalty/index.server';
import {
  applyPriceListToCartLines,
  getCustomerGroupIds,
} from '#/core/pricing/index.server';
import { resolveShippingOption } from '#/core/shipping/index.server';
import { getStoreCreditBalance } from '#/core/store-credit/index.server';
import { computeActiveTax } from '#/core/tax/index.server';

// ---------------------------------------------------------------------------
// computeTotals
// ---------------------------------------------------------------------------

/**
 * Compute full totals for a cart + checkout state.
 *
 * @param {{
 *   cart: object,
 *   shippingAddress?: object,
 *   couponCode?: string,
 *   shippingOptionId?: string,
 *   shippingOption?: object|null,
 *   taxExempt?: boolean,
 *   vatId?: string,
 *   customerId?: string,
 *   customerGroupId?: string,
 *   giftCardCode?: string,
 *   storeCreditCents?: number,
 *   loyaltyPointsCents?: number,
 *   salesChannelId?: string,
 * }} params
 * @returns {Promise<{
 *   subtotalCents: number,
 *   discountCents: number,
 *   shippingCents: number,
 *   taxCents: number,
 *   storeCreditCents: number,
 *   giftCardCents: number,
 *   loyaltyPointsCents: number,
 *   totalCents: number,
 *   shippingOption: object|null,
 *   appliedDiscounts: object[],
 *   freeShipping: boolean,
 *   primaryCouponCode: string|null,
 *   giftCardId: string|null,
 *   customerGroupIds: string[],
 * }>}
 */
export async function computeTotals({
  cart,
  shippingAddress,
  couponCode,
  shippingOptionId,
  shippingOption: persistedShippingOption = null,
  taxExempt = false,
  vatId,
  customerId,
  customerGroupId,
  giftCardCode,
  storeCreditCents: requestedStoreCreditCents = 0,
  loyaltyPointsCents: requestedLoyaltyPointsCents = 0,
  salesChannelId,
}) {
  const currency = cart?.currency ?? 'USD';
  const customerGroupIds = customerGroupId
    ? [customerGroupId]
    : customerId
      ? await getCustomerGroupIds(customerId)
      : [];

  const pricedCart = await applyPriceListToCartLines(cart, {
    customerGroupIds,
    salesChannelId,
  });
  const lines = pricedCart.lines ?? [];
  const { subtotalCents } = summarizeCartLines(lines);

  let discountCents = 0;
  let freeShipping = false;
  let appliedDiscounts = [];
  let primaryCouponCode = null;

  try {
    const promo = await resolvePromotions({
      cart: pricedCart,
      couponCode,
      customerGroupId: customerGroupIds[0] ?? null,
    });
    discountCents = promo.discountCents;
    freeShipping = promo.freeShipping;
    appliedDiscounts = promo.applied;
    primaryCouponCode = promo.primaryCode;
  } catch {
    discountCents = 0;
  }

  let shippingCents = 0;
  let taxCents = 0;
  let shippingOption = null;

  if (shippingAddress) {
    if (shippingOptionId) {
      const resolved = await resolveShippingOption({
        cart: pricedCart,
        shippingAddress,
        optionId: shippingOptionId,
        persistedOption: persistedShippingOption,
      });
      shippingOption = resolved.option;
    }
    shippingCents = shippingOption?.priceCents ?? 0;
    if (freeShipping) shippingCents = 0;

    if (!taxExempt) {
      const taxLines = lines.map((line) => ({
        priceCents: line.priceCentsSnapshot,
        quantity: line.quantity,
        taxClassId: line.variant?.taxClassId ?? null,
        taxClassRate: line.variant?.taxClass?.rate ?? null,
      }));

      const taxResult = await computeActiveTax({
        subtotalCents: subtotalCents - discountCents,
        shippingCents,
        shippingAddress,
        currency,
        lines: taxLines,
        vatId,
      });
      taxCents = Math.round(taxResult.taxCents);
    }
  }

  const preTenderTotal =
    subtotalCents - discountCents + shippingCents + taxCents;
  let remaining = preTenderTotal;

  let storeCreditCents = 0;
  if (customerId && requestedStoreCreditCents > 0) {
    const balance = await getStoreCreditBalance(customerId);
    storeCreditCents = Math.min(
      balance,
      requestedStoreCreditCents,
      Math.max(0, remaining)
    );
    remaining -= storeCreditCents;
  }

  let giftCardCents = 0;
  let giftCardId = null;
  if (giftCardCode && remaining > 0) {
    try {
      const redemption = await resolveGiftCardRedemption(
        giftCardCode,
        currency,
        remaining
      );
      giftCardCents = redemption.amountCents;
      giftCardId = redemption.giftCard.id;
      remaining -= giftCardCents;
    } catch {
      giftCardCents = 0;
      giftCardId = null;
    }
  }

  let loyaltyPointsCents = 0;
  let loyaltyPointsRedeemed = 0;
  if (customerId && requestedLoyaltyPointsCents > 0 && remaining > 0) {
    const loyalty = await resolveLoyaltyRedemption(
      customerId,
      requestedLoyaltyPointsCents,
      remaining
    );
    loyaltyPointsCents = loyalty.loyaltyPointsCents;
    loyaltyPointsRedeemed = loyalty.pointsRedeemed;
    remaining -= loyaltyPointsCents;
  }

  const totalCents = Math.max(0, remaining);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    storeCreditCents,
    giftCardCents,
    loyaltyPointsCents,
    loyaltyPointsRedeemed,
    totalCents,
    shippingOption,
    appliedDiscounts,
    freeShipping,
    primaryCouponCode,
    giftCardId,
    customerGroupIds,
  };
}
