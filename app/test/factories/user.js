// app/test/factories/user.js
export function makeUser(overrides = {}) {
  return {
    id: 'user_1',
    email: 'admin@example.com',
    emailVerified: true,
    name: 'Admin User',
    image: null,
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
