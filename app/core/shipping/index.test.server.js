// app/core/shipping/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables are available inside vi.mock factories
// (vi.mock calls are hoisted to the top of the file by Vitest/Vite).
// ---------------------------------------------------------------------------

const { mockSettingsGet } = vi.hoisted(() => ({
  mockSettingsGet: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: mockSettingsGet,
}));

// prisma is imported by settings (transitively) — mock it to prevent
// real database connections during tests.
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
  computeZonePriceCents,
  flatRateProvider,
  getAllQuotes,
  getProvider,
  getQuotes,
  listProviders,
  loadShippingZones,
  normalizeShippingZone,
  registerProvider,
  resolveShippingOption,
} from '#/core/shipping/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCart(lines = [{ priceCentsSnapshot: 2000, quantity: 2 }]) {
  return { lines };
}

function makeAddress(country = 'AU') {
  return { country };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shipping registry', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  // 1. registerProvider + getProvider round-trip
  it('registerProvider + getProvider returns the same provider object', () => {
    const provider = { getQuotes: vi.fn() };
    registerProvider('my_carrier', provider);
    expect(getProvider('my_carrier')).toBe(provider);
  });

  // 2. getProvider throws for unknown id
  it('getProvider throws for an unknown provider id', () => {
    expect(() => getProvider('nonexistent')).toThrow(
      'Shipping provider "nonexistent" is not registered'
    );
  });

  // 3. listProviders returns registered ids
  it('listProviders returns all registered provider ids', () => {
    registerProvider('carrier_a', { getQuotes: vi.fn() });
    registerProvider('carrier_b', { getQuotes: vi.fn() });
    expect(listProviders()).toEqual(
      expect.arrayContaining(['carrier_a', 'carrier_b'])
    );
    expect(listProviders()).toHaveLength(2);
  });

  // 4. getQuotes delegates to the named provider
  it('getQuotes delegates to the registered provider', async () => {
    const fakeOption = {
      id: 'carrier_a:express',
      providerId: 'carrier_a',
      name: 'Express',
      priceCents: 999,
      estimatedDays: 2,
    };
    const provider = { getQuotes: vi.fn().mockResolvedValue([fakeOption]) };
    registerProvider('carrier_a', provider);

    const params = { cart: makeCart(), shippingAddress: makeAddress() };
    const result = await getQuotes('carrier_a', params);

    expect(provider.getQuotes).toHaveBeenCalledOnce();
    expect(provider.getQuotes).toHaveBeenCalledWith(params);
    expect(result).toEqual([fakeOption]);
  });

  // 5. getAllQuotes merges results from all providers
  it('getAllQuotes calls all registered providers and merges results', async () => {
    const optionA = {
      id: 'a:standard',
      providerId: 'a',
      name: 'A Standard',
      priceCents: 500,
      estimatedDays: 3,
    };
    const optionB = {
      id: 'b:express',
      providerId: 'b',
      name: 'B Express',
      priceCents: 1200,
      estimatedDays: 1,
    };

    registerProvider('a', { getQuotes: vi.fn().mockResolvedValue([optionA]) });
    registerProvider('b', { getQuotes: vi.fn().mockResolvedValue([optionB]) });

    const result = await getAllQuotes({
      cart: makeCart(),
      shippingAddress: makeAddress('US'),
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([optionA, optionB]));
  });
});

describe('flatRateProvider.getQuotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 6. Matches zone by country and returns correct option shape
  it('matches zone by country (AU → domestic zone)', async () => {
    mockSettingsGet.mockResolvedValue(null); // use defaults

    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 500, quantity: 1 }]),
      shippingAddress: makeAddress('AU'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'flat_rate:domestic',
      providerId: 'flat_rate',
      name: 'Domestic Shipping',
      priceCents: 1500,
      estimatedDays: 5,
    });
  });

  // 7. Applies free-shipping threshold — cart total >= freeOverCents → priceCents 0
  it('zeroes out rateCents when cart subtotal meets freeOverCents threshold', async () => {
    mockSettingsGet.mockResolvedValue(null); // use defaults (domestic: freeOverCents 10000)

    // 5 * 2000 = 10000 — exactly at threshold
    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 2000, quantity: 5 }]),
      shippingAddress: makeAddress('AU'),
    });

    expect(result).toHaveLength(1);
    expect(result[0].priceCents).toBe(0);
  });

  // 8. priceCents is NOT zeroed when cart is below freeOverCents
  it('keeps rateCents when cart subtotal is below freeOverCents threshold', async () => {
    mockSettingsGet.mockResolvedValue(null); // domestic: freeOverCents 10000

    // 4 * 2000 = 8000 — below threshold
    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 2000, quantity: 4 }]),
      shippingAddress: makeAddress('AU'),
    });

    expect(result[0].priceCents).toBe(1500);
  });

  // 9. Returns default option when no zone matches the country
  it('returns default option when no zone matches the shipping country', async () => {
    mockSettingsGet.mockResolvedValue(null); // use defaults (no zone for 'JP')

    const result = await flatRateProvider.getQuotes({
      cart: makeCart(),
      shippingAddress: makeAddress('JP'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'flat_rate:default',
      providerId: 'flat_rate',
      name: 'Standard Shipping',
      priceCents: 0,
      estimatedDays: null,
    });
  });

  // 10. Uses zones from settings when the setting is present
  it('reads zones from the shipping.zones setting when present', async () => {
    const customZones = [
      {
        id: 'local',
        label: 'Local Delivery',
        countries: ['DE'],
        rateCents: 500,
        freeOverCents: 5000,
        estimatedDays: 2,
      },
    ];
    mockSettingsGet.mockResolvedValue(customZones);

    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 1000, quantity: 1 }]),
      shippingAddress: makeAddress('DE'),
    });

    expect(mockSettingsGet).toHaveBeenCalledWith('shipping.zones');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'flat_rate:local',
      name: 'Local Delivery',
      priceCents: 500,
      estimatedDays: 2,
    });
  });

  // 11. International zone matches US address (from defaults)
  it('matches international zone for a US address', async () => {
    mockSettingsGet.mockResolvedValue(null); // use defaults

    // subtotal below freeOverCents (20000): 1000 * 1 = 1000
    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 1000, quantity: 1 }]),
      shippingAddress: makeAddress('US'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'flat_rate:international',
      providerId: 'flat_rate',
      name: 'International Shipping',
      priceCents: 3000,
      estimatedDays: 14,
    });
  });

  // 12. International free shipping threshold
  it('zeroes out international rate when cart meets freeOverCents threshold', async () => {
    mockSettingsGet.mockResolvedValue(null); // international: freeOverCents 20000

    // 4 * 5000 = 20000 — exactly at threshold
    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 5000, quantity: 4 }]),
      shippingAddress: makeAddress('GB'),
    });

    expect(result[0].priceCents).toBe(0);
  });

  // 13. Admin zone schema uses name + generated id
  it('normalizes admin-configured zones saved with name instead of label', async () => {
    mockSettingsGet.mockResolvedValue([
      {
        name: 'Local Delivery',
        countries: ['DE'],
        rateCents: 500,
        freeOverCents: null,
      },
    ]);

    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 1000, quantity: 1 }]),
      shippingAddress: makeAddress('DE'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'flat_rate:local_delivery',
      name: 'Local Delivery',
      priceCents: 500,
    });
  });

  // 14. null freeOverCents does not make shipping free
  it('charges full rate when freeOverCents is null', async () => {
    mockSettingsGet.mockResolvedValue([
      {
        id: 'local',
        name: 'Local Delivery',
        countries: ['DE'],
        rateCents: 500,
        freeOverCents: null,
      },
    ]);

    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 50000, quantity: 1 }]),
      shippingAddress: makeAddress('DE'),
    });

    expect(result[0].priceCents).toBe(500);
  });

  // 15. Empty configured zones array falls back to defaults
  it('uses default zones when shipping.zones is an empty array', async () => {
    mockSettingsGet.mockResolvedValue([]);

    const result = await flatRateProvider.getQuotes({
      cart: makeCart([{ priceCentsSnapshot: 1000, quantity: 1 }]),
      shippingAddress: makeAddress('AU'),
    });

    expect(result[0]).toMatchObject({
      id: 'flat_rate:domestic',
      name: 'Domestic Shipping',
      priceCents: 1500,
    });
  });
});

describe('shipping zone helpers', () => {
  it('loadShippingZones falls back to defaults for empty input', () => {
    expect(loadShippingZones([])).toHaveLength(2);
    expect(loadShippingZones(null)).toHaveLength(2);
  });

  it('normalizeShippingZone accepts legacy label field', () => {
    expect(
      normalizeShippingZone({ label: 'Legacy Zone', countries: ['AU'] }, 0)
    ).toMatchObject({
      id: 'legacy_zone',
      name: 'Legacy Zone',
    });
  });

  it('computeZonePriceCents ignores null freeOverCents', () => {
    expect(
      computeZonePriceCents({ rateCents: 500, freeOverCents: null }, 100000)
    ).toBe(500);
  });
});

describe('resolveShippingOption', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('returns persisted option when live quote is missing', async () => {
    const persistedOption = {
      id: 'flat_rate:domestic',
      priceCents: 1500,
      name: 'Domestic',
    };
    registerProvider('flat_rate', {
      getQuotes: vi.fn().mockResolvedValue([]),
    });

    const result = await resolveShippingOption({
      cart: makeCart(),
      shippingAddress: makeAddress('AU'),
      optionId: 'flat_rate:domestic',
      persistedOption,
    });

    expect(result.option).toEqual(persistedOption);
  });
});
