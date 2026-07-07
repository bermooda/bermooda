// app/core/address-validation/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn().mockResolvedValue('noop'),
}));

import logger from '#/utils/logger.server';
import {
  _registry,
  formatAddressValidationError,
  hasMinimumAddressFields,
  listProvidersWithDetails,
  noopProvider,
  normalizeAddressForSession,
  parseAddressInput,
  parseAddressJson,
  parseAddressValidationSettingsInput,
  parseValidatedAddressInput,
  registerProvider,
  resolveAddressValidationProvider,
  unregisterProvider,
  validateAddress,
} from '#/core/address-validation/index.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

beforeEach(() => {
  _registry.clear();
  registerProvider('noop', noopProvider);
  vi.clearAllMocks();
  settingsGet.mockResolvedValue('noop');
});

describe('registry', () => {
  it('registerProvider validates id and provider shape', () => {
    expect(() => registerProvider('', noopProvider)).toThrow(
      'Provider id must be a non-empty string'
    );
    expect(() => registerProvider('bad', null)).toThrow(
      'Provider must be an object'
    );
  });

  it('unregisterProvider removes a provider', () => {
    registerProvider('temp', noopProvider);
    unregisterProvider('temp');
    expect(listProvidersWithDetails().map((entry) => entry.id)).toEqual([
      'noop',
    ]);
  });

  it('listProvidersWithDetails returns id and name', () => {
    expect(listProvidersWithDetails()).toEqual([{ id: 'noop', name: 'No-op' }]);
  });
});

describe('noopProvider', () => {
  it('returns valid with normalized address', async () => {
    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await noopProvider.validate(addr);
    expect(result.valid).toBe(true);
    expect(result.normalized).toEqual(addr);
    expect(result.suggestions).toEqual([]);
  });
});

describe('parseAddressInput', () => {
  it('maps form fields to an address object', () => {
    const formData = new FormData();
    formData.set('firstName', 'Ada');
    formData.set('lastName', 'Lovelace');
    formData.set('line1', '1 Main St');
    formData.set('city', 'London');
    formData.set('country', 'GB');

    expect(parseAddressInput(formData)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      line1: '1 Main St',
      line2: null,
      city: 'London',
      state: null,
      postalCode: null,
      country: 'GB',
      phone: null,
    });
  });
});

describe('hasMinimumAddressFields', () => {
  it('requires line1, city, and country', () => {
    expect(
      hasMinimumAddressFields({ line1: '1 Main', city: 'X', country: 'AU' })
    ).toBe(true);
    expect(hasMinimumAddressFields({ line1: '1 Main', city: 'X' })).toBe(false);
  });
});

describe('parseValidatedAddressInput', () => {
  it('returns the nested address payload when fields are present', () => {
    const address = { line1: '1 Main', city: 'Sydney', country: 'AU' };
    expect(parseValidatedAddressInput({ address })).toEqual(address);
  });

  it('throws when required fields are missing', () => {
    expect(() => parseValidatedAddressInput({ line1: '1 Main' })).toThrow(
      'Address must include line1, city, and country'
    );
  });
});

describe('parseAddressJson', () => {
  it('parses JSON strings and passes through objects', () => {
    expect(parseAddressJson('{"line1":"1 Main St"}')).toEqual({
      line1: '1 Main St',
    });
    expect(parseAddressJson({ line1: '1 Main St' })).toEqual({
      line1: '1 Main St',
    });
    expect(parseAddressJson('not-json')).toBeNull();
  });
});

describe('formatAddressValidationError', () => {
  it('prefers provider messages', () => {
    expect(
      formatAddressValidationError({ messages: ['Invalid postal code'] })
    ).toBe('Invalid postal code');
  });
});

describe('parseAddressValidationSettingsInput', () => {
  it('defaults to noop and trims provider id', () => {
    expect(parseAddressValidationSettingsInput({})).toEqual({
      provider: 'noop',
    });
    expect(parseAddressValidationSettingsInput({ provider: ' noop ' })).toEqual(
      {
        provider: 'noop',
      }
    );
  });
});

describe('resolveAddressValidationProvider', () => {
  it('throws for unknown providers', () => {
    expect(() => resolveAddressValidationProvider('missing')).toThrow(
      'Unknown address validation provider "missing"'
    );
  });
});

describe('validateAddress', () => {
  it('uses active provider from settings', async () => {
    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await validateAddress(addr);
    expect(result.valid).toBe(true);
    expect(result.provider).toBe('noop');
    expect(settingsGet).toHaveBeenCalledWith(
      SETTING_KEYS.ADDRESS_VALIDATION_PROVIDER
    );
  });

  it('delegates to a custom registered provider', async () => {
    registerProvider('custom', {
      name: 'Custom',
      validate: vi.fn().mockResolvedValue({
        valid: false,
        normalized: null,
        suggestions: [{ line1: '2 Main St' }],
        messages: ['Invalid address'],
      }),
    });
    settingsGet.mockResolvedValue('custom');

    const result = await validateAddress({
      line1: '1 Main St',
      city: 'Sydney',
      country: 'AU',
    });

    expect(result.valid).toBe(false);
    expect(result.provider).toBe('custom');
    expect(result.messages).toEqual(['Invalid address']);
  });

  it('throws when settings point to an unregistered provider', async () => {
    settingsGet.mockResolvedValue('missing');

    await expect(
      validateAddress({ line1: '1 Main St', city: 'Sydney', country: 'AU' })
    ).rejects.toThrow(
      'Address validation provider "missing" is not registered'
    );
  });
});

describe('normalizeAddressForSession', () => {
  it('returns hasAddress false when minimum fields are missing', async () => {
    const result = await normalizeAddressForSession({ line1: '1 Main St' });
    expect(result.hasAddress).toBe(false);
  });

  it('normalizes valid addresses', async () => {
    registerProvider('custom', {
      name: 'Custom',
      validate: vi.fn().mockResolvedValue({
        valid: true,
        normalized: { line1: '2 Main St', city: 'Sydney', country: 'AU' },
        suggestions: [],
      }),
    });
    settingsGet.mockResolvedValue('custom');

    const result = await normalizeAddressForSession({
      line1: '1 Main St',
      city: 'Sydney',
      country: 'AU',
    });

    expect(result.hasAddress).toBe(true);
    expect(result.normalizedAddr.line1).toBe('2 Main St');
  });

  it('keeps raw address on soft validation failure', async () => {
    registerProvider('custom', {
      name: 'Custom',
      validate: vi.fn().mockResolvedValue({
        valid: false,
        normalized: null,
        suggestions: [],
        messages: ['Invalid address'],
      }),
    });
    settingsGet.mockResolvedValue('custom');

    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await normalizeAddressForSession(addr);

    expect(result.normalizedAddr).toEqual(addr);
    expect(result.validation?.valid).toBe(false);
  });

  it('throws on strict validation failure', async () => {
    registerProvider('custom', {
      name: 'Custom',
      validate: vi.fn().mockResolvedValue({
        valid: false,
        normalized: null,
        suggestions: [],
        messages: ['Invalid address'],
      }),
    });
    settingsGet.mockResolvedValue('custom');

    await expect(
      normalizeAddressForSession(
        { line1: '1 Main St', city: 'Sydney', country: 'AU' },
        { strict: true }
      )
    ).rejects.toThrow('Invalid address');
  });

  it('logs and keeps raw address when provider throws in soft mode', async () => {
    registerProvider('custom', {
      name: 'Custom',
      validate: vi.fn().mockRejectedValue(new Error('Provider down')),
    });
    settingsGet.mockResolvedValue('custom');

    const addr = { line1: '1 Main St', city: 'Sydney', country: 'AU' };
    const result = await normalizeAddressForSession(addr);

    expect(result.normalizedAddr).toEqual(addr);
    expect(logger.warn).toHaveBeenCalled();
  });
});
