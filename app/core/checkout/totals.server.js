// app/core/checkout/totals.server.js
// Totals engine: compute subtotal, discount, shipping, tax, and total for a cart+checkout state.

import { validateDiscount } from '#/core/discounts/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { computeActiveTax } from '#/core/tax/index.server';

// ---------------------------------------------------------------------------
// computeTotals
// ---------------------------------------------------------------------------

/**
 * Compute full totals for a cart + checkout state.
 *
 * @param {{ cart: object, shippingAddress?: object, couponCode?: string, shippingOptionId?: string }} params
 * @returns {Promise<{
 *   subtotalCents: number,
 *   discountCents: number,
 *   shippingCents: number,
 *   taxCents: number,
 *   totalCents: number,
 *   shippingOption: object|null
 * }>}
 */
export async function computeTotals({ cart, shippingAddress, couponCode, shippingOptionId }) {
  // 1. Subtotal
  const lines = cart?.lines ?? [];
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  // 2. Discount — validate without incrementing usedCount
  let discountCents = 0;
  if (couponCode) {
    try {
      const result = await validateDiscount(couponCode, {
        subtotalCents,
        currency: cart?.currency ?? 'USD',
      });
      discountCents = result.discountCents;
    } catch {
      // Invalid/expired/unknown coupon — treat as no discount
      discountCents = 0;
    }
  }

  // 3. Shipping + Tax — both require a shippingAddress
  let shippingCents = 0;
  let taxCents = 0;
  let shippingOption = null;

  if (shippingAddress) {
    // Shipping
    const quotes = await getAllQuotes({ cart, shippingAddress });
    if (shippingOptionId) {
      shippingOption = quotes.find((q) => q.id === shippingOptionId) ?? null;
    }
    shippingCents = shippingOption ? shippingOption.priceCents : 0;

    // Tax — base is subtotal minus discount
    const taxBase = subtotalCents - discountCents;
    const taxResult = await computeActiveTax({
      subtotalCents: taxBase,
      shippingCents,
      shippingAddress,
      currency: cart?.currency ?? 'USD',
    });
    taxCents = Math.round(taxResult.taxCents);
  }

  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    shippingOption,
  };
}
