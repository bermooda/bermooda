// app/core/address-validation/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn().mockResolvedValue('noop'),
}));

import {
  _registry,
  noopProvider,
  registerProvider,
  validateAddress,
} from '#/core/address-validation/index.server';

beforeEach(() => {
  _registry.clear();
  registerProvider('noop', noopProvider);
});

describe('address validation', () => {
  it('noop provider returns valid with normalized address', async () => {
    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await noopProvider.validate(addr);
    expect(result.valid).toBe(true);
    expect(result.normalized).toEqual(addr);
  });

  it('validateAddress uses active provider from settings', async () => {
    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await validateAddress(addr);
    expect(result.valid).toBe(true);
    expect(result.provider).toBe('noop');
  });
});
