// app/test/factories/cart.js
export function makeCart(overrides = {}) {
  return {
    id: 'cart_1',
    token: 'test-token-uuid',
    customerId: null,
    currency: 'USD',
    lockedAt: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lines: [],
    ...overrides,
  };
}

export function makeCartLine(overrides = {}) {
  return {
    id: 'line_1',
    cartId: 'cart_1',
    variantId: 'variant_1',
    quantity: 1,
    priceCentsSnapshot: 1999,
    titleSnapshot: 'Test Product',
    ...overrides,
  };
}
