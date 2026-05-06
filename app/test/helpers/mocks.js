// app/test/helpers/mocks.js
// Shared mock factory helpers for common Prisma model operations.
import { vi } from 'vitest';

/**
 * Create a minimal prisma mock with the provided model names.
 * Usage: const prismaMock = makePrismaMock(['product', 'variant']);
 */
export function makePrismaMock(models = []) {
  const mock = {
    $transaction: vi.fn(async (ops) => {
      if (typeof ops === 'function') return ops(mock);
      return Promise.all(ops);
    }),
  };
  for (const model of models) {
    mock[model] = {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    };
  }
  return mock;
}

/**
 * Create a minimal logger mock.
 */
export function makeLoggerMock() {
  const child = vi.fn();
  const mock = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => mock),
  };
  child.mockReturnValue(mock);
  return mock;
}
