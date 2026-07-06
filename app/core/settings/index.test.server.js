// app/core/settings/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('#/utils/cache.server', () => ({
  getCachedResult: vi.fn(async (_k, cb) => cb()),
  default: { delete: vi.fn() },
}));

import cache, { getCachedResult } from '#/utils/cache.server';
import prisma from '#/libs/prisma.server';
import { get, set, seedDefaults } from '#/core/settings/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe('get', () => {
  it('calls getCachedResult with key "setting:<key>" and returns parsed JSON value', async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: 'defaultCurrency',
      value: '"USD"',
    });

    const result = await get('defaultCurrency');

    expect(getCachedResult).toHaveBeenCalledWith(
      'setting:defaultCurrency',
      expect.any(Function)
    );
    expect(result).toBe('USD');
  });

  it('returns null when setting not found', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);

    const result = await get('missing');

    expect(result).toBeNull();
  });

  it('returns raw string when value is not valid JSON', async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: 'activeTheme',
      value: 'default',
    });

    const result = await get('activeTheme');

    expect(result).toBe('default');
  });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

describe('set', () => {
  it('calls prisma.setting.upsert with JSON.stringify(value) and invalidates cache', async () => {
    prisma.setting.upsert.mockResolvedValue({});

    await set('defaultCurrency', 'EUR');

    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'defaultCurrency' },
      create: { key: 'defaultCurrency', value: '"EUR"' },
      update: { value: '"EUR"' },
    });
    expect(cache.delete).toHaveBeenCalledWith('setting:defaultCurrency');
  });
});

// ---------------------------------------------------------------------------
// seedDefaults
// ---------------------------------------------------------------------------

describe('seedDefaults', () => {
  it('writes all 6 defaults when none exist', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.setting.upsert.mockResolvedValue({});

    await seedDefaults();

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(6);

    const keys = prisma.setting.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'defaultCurrency',
        'currencies',
        'defaultLocale',
        'locales',
        'activeTheme',
        'pluginOrder',
      ])
    );

    // Scalar string defaults must be JSON.stringify'd (value: '"USD"', not 'USD').
    const currencyCall = prisma.setting.upsert.mock.calls.find(
      (c) => c[0].where.key === 'defaultCurrency'
    );
    expect(currencyCall[0].create.value).toBe('"USD"');
    expect(currencyCall[0].update.value).toBe('"USD"');
  });

  it('skips keys that already exist', async () => {
    // Only 'defaultCurrency' exists; the rest return null.
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) => {
      if (key === 'defaultCurrency') {
        return Promise.resolve({ key, value: '"USD"' });
      }
      return Promise.resolve(null);
    });
    prisma.setting.upsert.mockResolvedValue({});

    await seedDefaults();

    // 5 writes: all defaults except the already-existing defaultCurrency.
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(5);

    const keys = prisma.setting.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).not.toContain('defaultCurrency');
  });
});
