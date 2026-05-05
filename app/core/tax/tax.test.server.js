// app/core/tax/tax.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables are available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockSettingsGet } = vi.hoisted(() => ({
  mockSettingsGet: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: mockSettingsGet,
}));

// prisma is imported transitively — mock to prevent real DB connections
vi.mock('#/libs/prisma.server', () => ({
  default: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

import {
  _registry,
  computeActiveTax,
  computeTax,
  getProvider,
  listProviders,
  registerProvider,
  simplePercentProvider,
} from './index.server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAddress(country, state) {
  return state ? { country, state } : { country };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tax registry', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  // 1. registerProvider + getProvider round-trip
  it('registerProvider + getProvider returns the same provider object', () => {
    const provider = { compute: vi.fn() };
    registerProvider('my_tax', provider);
    expect(getProvider('my_tax')).toBe(provider);
  });

  // 2. getProvider throws for unknown id
  it('getProvider throws for an unknown provider id', () => {
    expect(() => getProvider('nonexistent')).toThrow(
      'Tax provider "nonexistent" is not registered'
    );
  });

  // 3. listProviders returns all registered ids
  it('listProviders returns all registered provider ids', () => {
    registerProvider('tax_a', { compute: vi.fn() });
    registerProvider('tax_b', { compute: vi.fn() });
    expect(listProviders()).toEqual(expect.arrayContaining(['tax_a', 'tax_b']));
    expect(listProviders()).toHaveLength(2);
  });

  // 4. computeTax delegates to provider and includes provider id in result
  it('computeTax delegates to named provider and includes provider in result', async () => {
    const provider = {
      compute: vi.fn().mockResolvedValue({ taxCents: 100, rate: 0.1 }),
    };
    registerProvider('test_tax', provider);

    const params = {
      subtotalCents: 1000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    };

    const result = await computeTax('test_tax', params);

    expect(provider.compute).toHaveBeenCalledOnce();
    expect(result).toEqual({ taxCents: 100, rate: 0.1, provider: 'test_tax' });
  });
});

describe('simplePercentProvider.compute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 5. Exclusive mode: tax = base * rate
  it('exclusive mode: taxCents = Math.round(base * rate)', async () => {
    mockSettingsGet.mockResolvedValue({
      mode: 'exclusive',
      regions: [{ country: 'AU', rate: 0.1 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 500,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    // base = 10500, tax = Math.round(10500 * 0.1) = 1050
    expect(result).toEqual({ taxCents: 1050, rate: 0.1 });
  });

  // 6. Inclusive mode: tax extracted from price
  it('inclusive mode: taxCents extracted using rate / (1 + rate)', async () => {
    mockSettingsGet.mockResolvedValue({
      mode: 'inclusive',
      regions: [{ country: 'AU', rate: 0.1 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 11000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    // base = 11000, tax = Math.round(11000 * 0.1 / 1.1) = Math.round(1000) = 1000
    expect(result).toEqual({ taxCents: 1000, rate: 0.1 });
  });

  // 7. Country + state match wins over country-only match
  it('country+state match takes priority over country-only match', async () => {
    mockSettingsGet.mockResolvedValue({
      mode: 'exclusive',
      regions: [
        { country: 'US', rate: 0.05 },           // country-only
        { country: 'US', state: 'CA', rate: 0.1 }, // country + state
      ],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('US', 'CA'),
      currency: 'USD',
    });

    // Should use the CA rate (0.1), not the US fallback (0.05)
    expect(result.rate).toBe(0.1);
    expect(result.taxCents).toBe(Math.round(10000 * 0.1));
  });

  // 8. No match → taxCents = 0, rate = 0
  it('returns taxCents = 0 and rate = 0 when no region matches', async () => {
    mockSettingsGet.mockResolvedValue({
      mode: 'exclusive',
      regions: [{ country: 'AU', rate: 0.1 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 500,
      shippingAddress: makeAddress('DE'),
      currency: 'EUR',
    });

    expect(result).toEqual({ taxCents: 0, rate: 0 });
  });

  // 9. Default config is used when setting is absent (AU exclusive 10%)
  it('uses default AU 10% exclusive config when tax.config setting is null', async () => {
    mockSettingsGet.mockResolvedValue(null);

    const result = await simplePercentProvider.compute({
      subtotalCents: 5000,
      shippingCents: 1000,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    // base = 6000, tax = Math.round(6000 * 0.1) = 600
    expect(result).toEqual({ taxCents: 600, rate: 0.1 });
  });

  // 10. Country fallback is used when state does not match any specific region
  it('falls back to country-only region when state has no specific region', async () => {
    mockSettingsGet.mockResolvedValue({
      mode: 'exclusive',
      regions: [
        { country: 'US', rate: 0.05 },
        { country: 'US', state: 'CA', rate: 0.1 },
      ],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('US', 'NY'), // NY not in regions — falls back to US
      currency: 'USD',
    });

    expect(result.rate).toBe(0.05);
    expect(result.taxCents).toBe(Math.round(10000 * 0.05));
  });
});

describe('computeActiveTax', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  // 11. Reads 'tax.provider' setting and routes to that provider
  it('reads tax.provider setting and uses that provider', async () => {
    const customProvider = {
      compute: vi.fn().mockResolvedValue({ taxCents: 200, rate: 0.2 }),
    };
    registerProvider('custom_tax', customProvider);

    // First call returns 'custom_tax', subsequent calls return null (for tax.config)
    mockSettingsGet.mockImplementation((key) => {
      if (key === 'tax.provider') return Promise.resolve('custom_tax');
      return Promise.resolve(null);
    });

    const result = await computeActiveTax({
      subtotalCents: 1000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    expect(mockSettingsGet).toHaveBeenCalledWith('tax.provider');
    expect(result).toEqual({ taxCents: 200, rate: 0.2, provider: 'custom_tax' });
  });

  // 12. Defaults to 'simple_percent' when tax.provider setting is absent
  it("defaults to 'simple_percent' provider when tax.provider setting is null", async () => {
    registerProvider('simple_percent', simplePercentProvider);

    mockSettingsGet.mockImplementation((key) => {
      if (key === 'tax.provider') return Promise.resolve(null);
      if (key === 'tax.config') return Promise.resolve({
        mode: 'exclusive',
        regions: [{ country: 'AU', rate: 0.1 }],
      });
      return Promise.resolve(null);
    });

    const result = await computeActiveTax({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    expect(result.provider).toBe('simple_percent');
    expect(result.taxCents).toBe(1000);
    expect(result.rate).toBe(0.1);
  });
});
