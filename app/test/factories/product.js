// app/test/factories/product.js
export function makeProduct(overrides = {}) {
  return {
    id: 'prod_1',
    publishedAt: null,
    position: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variants: [],
    media: [],
    categories: [],
    options: [],
    ...overrides,
  };
}
