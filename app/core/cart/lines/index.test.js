// app/core/cart/lines/index.test.js

import { describe, expect, it } from 'vitest';

import { cartLineTotal, summarizeCartLines } from '#/core/cart/lines';

describe('cartLineTotal', () => {
  it('returns priceCentsSnapshot multiplied by quantity', () => {
    expect(cartLineTotal({ priceCentsSnapshot: 1000, quantity: 2 })).toBe(2000);
  });
});

describe('summarizeCartLines', () => {
  it('returns subtotal and total quantity for cart lines', () => {
    expect(
      summarizeCartLines([
        { priceCentsSnapshot: 1000, quantity: 2 },
        { priceCentsSnapshot: 500, quantity: 1 },
      ])
    ).toEqual({ subtotalCents: 2500, totalQuantity: 3 });
  });

  it('returns zeros for empty lines', () => {
    expect(summarizeCartLines([])).toEqual({
      subtotalCents: 0,
      totalQuantity: 0,
    });
  });
});
