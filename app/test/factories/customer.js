// app/test/factories/customer.js
export function makeCustomer(overrides = {}) {
  return {
    id: 'customer_1',
    email: 'customer@example.com',
    emailVerified: true,
    name: 'Test Customer',
    image: null,
    preferredLocale: 'en',
    preferredCurrency: 'USD',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
