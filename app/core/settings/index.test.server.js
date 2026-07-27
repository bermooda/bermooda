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

vi.mock('#/utils/cache/index.server', () => ({
  getCachedResult: vi.fn(async (_k, cb) => cb()),
  default: { delete: vi.fn() },
}));

import cache, { getCachedResult } from '#/utils/cache/index.server';
import prisma from '#/libs/prisma.server';
import { SETTING_DEFAULTS } from '#/core/settings/defaults';
import {
  applyAdminSettingsPatch,
  get,
  getAdminSettingsSnapshot,
  getEnabledCurrencies,
  getMany,
  parseAdminSettingsPatch,
  parseCurrencySettingsInput,
  parseGeneralSettingsInput,
  parseLocaleSettingsInput,
  seedDefaults,
  set,
  setMany,
} from '#/core/settings/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('getMany', () => {
  it('returns a map of parsed values', async () => {
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) => {
      if (key === 'shopName') return Promise.resolve({ key, value: '"Acme"' });
      if (key === 'defaultCurrency') {
        return Promise.resolve({ key, value: '"EUR"' });
      }
      return Promise.resolve(null);
    });

    const result = await getMany(['shopName', 'defaultCurrency', 'missing']);

    expect(result).toEqual({
      shopName: 'Acme',
      defaultCurrency: 'EUR',
      missing: null,
    });
  });
});

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

describe('setMany', () => {
  it('persists each key/value pair', async () => {
    prisma.setting.upsert.mockResolvedValue({});

    await setMany({ shopName: 'Acme', defaultCurrency: 'USD' });

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('getEnabledCurrencies', () => {
  it('returns normalized enabled currencies', async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: 'currencies',
      value: '["USD","EUR"]',
    });

    await expect(getEnabledCurrencies()).resolves.toEqual(['USD', 'EUR']);
  });

  it('falls back to defaults when unset', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);

    await expect(getEnabledCurrencies()).resolves.toEqual(
      SETTING_DEFAULTS.currencies
    );
  });
});

describe('getAdminSettingsSnapshot', () => {
  it('returns normalized admin settings with defaults', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);

    const snapshot = await getAdminSettingsSnapshot();

    expect(snapshot.shopName).toBe('');
    expect(snapshot.defaultCurrency).toBe('USD');
    expect(snapshot.currencies).toEqual(['USD', 'EUR', 'AUD']);
    expect(snapshot.locales).toEqual(['en']);
    expect(snapshot.taxMode).toBe('exclusive');
    expect(snapshot.addressValidationProvider).toBe('noop');
    expect(snapshot.emailProvider).toBe('resend');
    expect(snapshot.seoAllowIndexing).toBe(true);
  });
});

describe('parseGeneralSettingsInput', () => {
  it('trims shop fields', () => {
    expect(
      parseGeneralSettingsInput({
        shopName: '  Acme  ',
        contactEmail: ' hello@example.com ',
      })
    ).toEqual({
      shopName: 'Acme',
      contactEmail: 'hello@example.com',
    });
  });
});

describe('parseCurrencySettingsInput', () => {
  it('keeps default currency within enabled list', () => {
    expect(
      parseCurrencySettingsInput({
        currencies: ['EUR'],
        defaultCurrency: 'USD',
      })
    ).toEqual({
      currencies: ['EUR'],
      defaultCurrency: 'EUR',
    });
  });
});

describe('parseLocaleSettingsInput', () => {
  it('keeps default locale within enabled list', () => {
    expect(
      parseLocaleSettingsInput({
        locales: ['de'],
        defaultLocale: 'en',
      })
    ).toEqual({
      locales: ['de'],
      defaultLocale: 'de',
    });
  });
});

describe('parseAdminSettingsPatch', () => {
  it('parses grouped API payloads', () => {
    expect(parseAdminSettingsPatch({ general: { shopName: 'Acme' } })).toEqual({
      section: 'general',
      values: { shopName: 'Acme', contactEmail: '' },
    });

    expect(
      parseAdminSettingsPatch({
        tax: { mode: 'inclusive', regions: [{ country: 'US', percent: 8 }] },
      })
    ).toMatchObject({
      section: 'tax',
      values: { mode: 'inclusive' },
    });

    expect(
      parseAdminSettingsPatch({
        addressValidation: { provider: 'noop' },
      })
    ).toEqual({
      section: 'addressValidation',
      values: { provider: 'noop' },
    });

    expect(
      parseAdminSettingsPatch({
        email: { provider: 'sendgrid' },
      })
    ).toEqual({
      section: 'email',
      values: { provider: 'sendgrid' },
    });
  });

  it('returns null for empty payloads', () => {
    expect(parseAdminSettingsPatch({})).toBeNull();
    expect(parseAdminSettingsPatch({ seo: {} })).toBeNull();
  });
});

describe('applyAdminSettingsPatch', () => {
  it('writes general settings', async () => {
    prisma.setting.upsert.mockResolvedValue({});

    await applyAdminSettingsPatch({
      section: 'general',
      values: { shopName: 'Acme', contactEmail: 'hello@example.com' },
    });

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'shopName' },
        create: expect.objectContaining({ value: '"Acme"' }),
      })
    );
  });
});

describe('seedDefaults', () => {
  it('writes all defaults when none exist', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.setting.upsert.mockResolvedValue({});

    await seedDefaults();

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(
      Object.keys(SETTING_DEFAULTS).length
    );

    const keys = prisma.setting.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).toEqual(expect.arrayContaining(Object.keys(SETTING_DEFAULTS)));

    const currencyCall = prisma.setting.upsert.mock.calls.find(
      (c) => c[0].where.key === 'defaultCurrency'
    );
    expect(currencyCall[0].create.value).toBe('"USD"');
  });

  it('skips keys that already exist', async () => {
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) => {
      if (key === 'defaultCurrency') {
        return Promise.resolve({ key, value: '"USD"' });
      }
      return Promise.resolve(null);
    });
    prisma.setting.upsert.mockResolvedValue({});

    await seedDefaults();

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(
      Object.keys(SETTING_DEFAULTS).length - 1
    );

    const keys = prisma.setting.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).not.toContain('defaultCurrency');
  });
});
