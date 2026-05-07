// app/test/factories/order.js
export function makeOrder(overrides = {}) {
  return {
    id: 'order_1',
    orderNumber: 'ORD-001',
    customerId: null,
    status: 'pending',
    currency: 'USD',
    subtotalCents: 1999,
    shippingCents: 0,
    taxCents: 0,
    discountCents: 0,
    totalCents: 1999,
    shippingAddress: null,
    billingAddress: null,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lines: [],
    shipments: [],
    ...overrides,
  };
}

export function makeOrderLine(overrides = {}) {
  return {
    id: 'ol_1',
    orderId: 'order_1',
    variantId: 'variant_1',
    quantity: 1,
    unitPriceCents: 1999,
    totalCents: 1999,
    titleSnapshot: 'Test Product',
    skuSnapshot: 'SKU-001',
    ...overrides,
  };
}
