// app/test/factories/variant.js
export function makeVariant(overrides = {}) {
  return {
    id: 'variant_1',
    productId: 'prod_1',
    sku: 'SKU-001',
    inventoryQuantity: 100,
    inventoryTracked: true,
    position: 0,
    prices: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function makeVariantPrice(overrides = {}) {
  return {
    id: 'vp_1',
    variantId: 'variant_1',
    currency: 'USD',
    priceCents: 1999,
    comparePriceCents: null,
    ...overrides,
  };
}
