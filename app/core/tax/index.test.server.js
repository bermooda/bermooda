// app/core/tax/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSettingsGet } = vi.hoisted(() => ({
  mockSettingsGet: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: mockSettingsGet,
}));

import {
  _registry,
  computeActiveTax,
  computeTax,
  computeTaxCents,
  getProvider,
  loadTaxConfig,
  registerProvider,
  resolveRegionRate,
  simplePercentProvider,
} from '#/core/tax/index.server';

function makeAddress(country, state) {
  return state ? { country, state } : { country };
}

function mockTaxSettings({
  mode = 'exclusive',
  regions = [{ country: 'AU', percent: 10 }],
} = {}) {
  mockSettingsGet.mockImplementation((key) => {
    if (key === 'tax.mode') return Promise.resolve(mode);
    if (key === 'tax.regions') return Promise.resolve(regions);
    return Promise.resolve(null);
  });
}

describe('tax registry', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('registerProvider + getProvider returns the same provider object', () => {
    const provider = { compute: vi.fn() };
    registerProvider('my_tax', provider);
    expect(getProvider('my_tax')).toBe(provider);
  });

  it('getProvider throws for an unknown provider id', () => {
    expect(() => getProvider('nonexistent')).toThrow(
      'Tax provider "nonexistent" is not registered'
    );
  });

  it('computeTax delegates to named provider and passes vatId through', async () => {
    const provider = {
      compute: vi.fn().mockResolvedValue({ taxCents: 100, rate: 0.1 }),
    };
    registerProvider('test_tax', provider);

    const params = {
      subtotalCents: 1000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
      vatId: 'VAT-123',
    };

    const result = await computeTax('test_tax', params);

    expect(provider.compute).toHaveBeenCalledOnce();
    expect(provider.compute).toHaveBeenCalledWith(params);
    expect(result).toEqual({ taxCents: 100, rate: 0.1, provider: 'test_tax' });
  });
});

describe('loadTaxConfig + resolveRegionRate', () => {
  it('normalizes admin tax regions with percent values', () => {
    const config = loadTaxConfig('exclusive', [
      { country: 'au', percent: 10 },
      { country: 'US', state: 'CA', percent: 8.25 },
    ]);

    expect(config.mode).toBe('exclusive');
    expect(config.regions[0]).toEqual({
      country: 'AU',
      state: null,
      percent: 10,
    });
    expect(resolveRegionRate(config, makeAddress('US', 'CA'))).toBe(0.0825);
  });

  it('supports legacy decimal rate values', () => {
    const config = loadTaxConfig('exclusive', [{ country: 'AU', rate: 0.1 }]);
    expect(resolveRegionRate(config, makeAddress('AU'))).toBe(0.1);
  });
});

describe('computeTaxCents', () => {
  it('extracts inclusive tax from a tax-included base', () => {
    expect(
      computeTaxCents({ baseCents: 11000, rate: 0.1, mode: 'inclusive' })
    ).toBe(1000);
  });
});

describe('simplePercentProvider.compute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exclusive mode: taxCents = Math.round(base * rate)', async () => {
    mockTaxSettings({
      mode: 'exclusive',
      regions: [{ country: 'AU', percent: 10 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 500,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    expect(result).toEqual({ taxCents: 1050, rate: 0.1 });
  });

  it('inclusive mode: taxCents extracted using rate / (1 + rate)', async () => {
    mockTaxSettings({
      mode: 'inclusive',
      regions: [{ country: 'AU', percent: 10 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 11000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    expect(result).toEqual({ taxCents: 1000, rate: 0.1 });
  });

  it('country+state match takes priority over country-only match', async () => {
    mockTaxSettings({
      regions: [
        { country: 'US', percent: 5 },
        { country: 'US', state: 'CA', percent: 10 },
      ],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('US', 'CA'),
      currency: 'USD',
    });

    expect(result.rate).toBe(0.1);
    expect(result.taxCents).toBe(Math.round(10000 * 0.1));
  });

  it('returns taxCents = 0 and rate = 0 when no region matches', async () => {
    mockTaxSettings({
      regions: [{ country: 'AU', percent: 10 }],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 500,
      shippingAddress: makeAddress('DE'),
      currency: 'EUR',
    });

    expect(result).toEqual({ taxCents: 0, rate: 0 });
  });

  it('uses default AU 10% exclusive config when admin tax settings are null', async () => {
    mockSettingsGet.mockResolvedValue(null);

    const result = await simplePercentProvider.compute({
      subtotalCents: 5000,
      shippingCents: 1000,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
    });

    expect(result).toEqual({ taxCents: 600, rate: 0.1 });
  });

  it('falls back to country-only region when state has no specific region', async () => {
    mockTaxSettings({
      regions: [
        { country: 'US', percent: 5 },
        { country: 'US', state: 'CA', percent: 10 },
      ],
    });

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('US', 'NY'),
      currency: 'USD',
    });

    expect(result.rate).toBe(0.05);
    expect(result.taxCents).toBe(Math.round(10000 * 0.05));
  });

  it('returns zero tax when a VAT ID is present', async () => {
    mockTaxSettings();

    const result = await simplePercentProvider.compute({
      subtotalCents: 10000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
      vatId: 'AU123456',
    });

    expect(result).toEqual({ taxCents: 0, rate: 0 });
  });
});

describe('computeActiveTax', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('reads tax.provider setting and uses that provider', async () => {
    const customProvider = {
      compute: vi.fn().mockResolvedValue({ taxCents: 200, rate: 0.2 }),
    };
    registerProvider('custom_tax', customProvider);

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
    expect(result).toEqual({
      taxCents: 200,
      rate: 0.2,
      provider: 'custom_tax',
    });
  });

  it("defaults to 'simple_percent' provider when tax.provider setting is null", async () => {
    registerProvider('simple_percent', simplePercentProvider);

    mockSettingsGet.mockImplementation((key) => {
      if (key === 'tax.provider') return Promise.resolve(null);
      if (key === 'tax.mode') return Promise.resolve('exclusive');
      if (key === 'tax.regions')
        return Promise.resolve([{ country: 'AU', percent: 10 }]);
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

  it('applies per-line tax classes with inclusive mode and zero-rates B2B VAT IDs', async () => {
    registerProvider('simple_percent', simplePercentProvider);

    mockSettingsGet.mockImplementation((key) => {
      if (key === 'tax.provider') return Promise.resolve('simple_percent');
      if (key === 'tax.mode') return Promise.resolve('inclusive');
      if (key === 'tax.regions')
        return Promise.resolve([{ country: 'AU', percent: 10 }]);
      return Promise.resolve(null);
    });

    const taxed = await computeActiveTax({
      subtotalCents: 11000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
      lines: [{ priceCents: 11000, quantity: 1, taxClassId: 'tc1' }],
    });

    expect(taxed.taxCents).toBe(1000);

    const exempt = await computeActiveTax({
      subtotalCents: 11000,
      shippingCents: 0,
      shippingAddress: makeAddress('AU'),
      currency: 'AUD',
      vatId: 'AU123456',
      lines: [{ priceCents: 11000, quantity: 1, taxClassId: 'tc1' }],
    });

    expect(exempt.taxCents).toBe(0);
  });
});
