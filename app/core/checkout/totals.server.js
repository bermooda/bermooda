// app/core/checkout/totals.server.js
// Totals engine: subtotal, multi-discount, shipping, tax-class-aware tax, total.

import { resolvePromotions } from '#/core/discounts/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { computeActiveTax } from '#/core/tax/index.server';

// ---------------------------------------------------------------------------
// computeTotals
// ---------------------------------------------------------------------------

/**
 * Compute full totals for a cart + checkout state.
 *
 * @param {{
 *   cart: object,
 *   cartId?: string,
 *   shippingAddress?: object,
 *   couponCode?: string,
 *   couponCodes?: string[],
 *   shippingOptionId?: string,
 *   taxExempt?: boolean,
 *   vatId?: string,
 *   customerGroupId?: string,
 * }} params
 * @returns {Promise<{
 *   subtotalCents: number,
 *   discountCents: number,
 *   shippingCents: number,
 *   taxCents: number,
 *   totalCents: number,
 *   shippingOption: object|null,
 *   appliedDiscounts: object[],
 *   freeShipping: boolean,
 *   primaryCouponCode: string|null
 * }>}
 */
export async function computeTotals({
  cart,
  cartId,
  shippingAddress,
  couponCode,
  couponCodes,
  shippingOptionId,
  taxExempt = false,
  vatId,
  customerGroupId,
}) {
  const lines = cart?.lines ?? [];
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  // 1. Promotions — automatic + stacked coupon codes
  let discountCents = 0;
  let freeShipping = false;
  let appliedDiscounts = [];
  let primaryCouponCode = null;

  try {
    const promo = await resolvePromotions({
      cart,
      cartId,
      couponCode,
      couponCodes,
      customerGroupId,
    });
    discountCents = promo.discountCents;
    freeShipping = promo.freeShipping;
    appliedDiscounts = promo.applied;
    primaryCouponCode = promo.primaryCode;
  } catch {
    discountCents = 0;
  }

  // 2. Shipping + tax — require shippingAddress
  let shippingCents = 0;
  let taxCents = 0;
  let shippingOption = null;

  if (shippingAddress) {
    const quotes = await getAllQuotes({ cart, shippingAddress });
    if (shippingOptionId) {
      shippingOption = quotes.find((q) => q.id === shippingOptionId) ?? null;
    }
    shippingCents = shippingOption ? shippingOption.priceCents : 0;
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
        currency: cart?.currency ?? 'USD',
        lines: taxLines,
        vatId,
      });
      taxCents = Math.round(taxResult.taxCents);
    }
  }

  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    shippingOption,
    appliedDiscounts,
    freeShipping,
    primaryCouponCode,
  };
}
