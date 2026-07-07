// app/core/address-validation/index.server.js
// Pluggable address validation provider registry.

import logger from '#/utils/logger.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();

export const DEFAULT_ADDRESS_VALIDATION_PROVIDER = 'noop';

/**
 * Register an address-validation provider.
 * Providers must expose:
 *   validate(address): Promise<{ valid, normalized, suggestions, messages? }>
 *
 * @param {string} id
 * @param {Object} provider
 */
export function registerProvider(id, provider) {
  if (!id || typeof id !== 'string') {
    throw new Error('Provider id must be a non-empty string');
  }
  if (!provider || typeof provider !== 'object') {
    throw new Error('Provider must be an object');
  }
  _registry.set(id, provider);
}

/**
 * @param {string} id
 */
export function unregisterProvider(id) {
  _registry.delete(id);
}

/**
 * @param {string} id
 * @returns {Object}
 */
function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Address validation provider "${id}" is not registered`);
  }
  return provider;
}

/**
 * List registered providers with id and name for admin UI.
 *
 * @returns {{ id: string, name: string }[]}
 */
export function listProvidersWithDetails() {
  return Array.from(_registry.entries()).map(([id, provider]) => ({
    id,
    name: provider.name ?? id,
  }));
}

// ---------------------------------------------------------------------------
// Built-in no-op provider
// ---------------------------------------------------------------------------

export const noopProvider = {
  name: 'No-op',

  /**
   * @param {object} address
   * @returns {Promise<{ valid: boolean, normalized: object, suggestions: object[] }>}
   */
  async validate(address) {
    return {
      valid: true,
      normalized: address,
      suggestions: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

/**
 * Parse address fields from a form payload or plain object.
 *
 * @param {Record<string, unknown>|FormData} rawData
 */
export function parseAddressInput(rawData) {
  const get = (key) => {
    const value =
      rawData instanceof FormData ? rawData.get(key) : rawData?.[key];
    if (value === null || value === undefined) return undefined;
    return value.toString();
  };

  return {
    firstName: get('firstName') ?? '',
    lastName: get('lastName') ?? '',
    line1: get('line1') ?? '',
    line2: get('line2') || null,
    city: get('city') ?? '',
    state: get('state') || null,
    postalCode: get('postalCode') || null,
    country: get('country') ?? '',
    phone: get('phone') || null,
  };
}

/**
 * @param {object|null|undefined} addr
 */
export function hasMinimumAddressFields(addr) {
  return Boolean(addr?.line1 && addr?.city && addr?.country);
}

/**
 * @param {string|object|null|undefined} json
 */
export function parseAddressJson(json) {
  if (!json) return null;
  if (typeof json === 'object') return json;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @param {{ messages?: string[], suggestions?: object[] }|null|undefined} validation
 */
export function formatAddressValidationError(validation) {
  if (validation?.messages?.length) {
    return validation.messages[0];
  }
  return 'Please check your shipping address.';
}

/**
 * Validate provider id from admin/API settings payloads.
 *
 * @param {string} providerId
 */
export function resolveAddressValidationProvider(providerId) {
  const normalized = String(providerId ?? '').trim();
  if (!normalized || !_registry.has(normalized)) {
    throw new Error(`Unknown address validation provider "${providerId}"`);
  }
  return normalized;
}

/**
 * Parse admin/API address validation settings payload.
 *
 * @param {object} input
 */
export function parseAddressValidationSettingsInput(input = {}) {
  const provider = String(
    input.provider ?? input.addressValidationProvider ?? ''
  ).trim();
  return {
    provider: provider || DEFAULT_ADDRESS_VALIDATION_PROVIDER,
  };
}

// ---------------------------------------------------------------------------
// Active provider helpers
// ---------------------------------------------------------------------------

/**
 * Validate an address using the active provider from settings.
 *
 * @param {object} address
 */
export async function validateAddress(address) {
  const providerId =
    (await settingsGet(SETTING_KEYS.ADDRESS_VALIDATION_PROVIDER)) ??
    DEFAULT_ADDRESS_VALIDATION_PROVIDER;
  const provider = getProvider(providerId);
  const result = await provider.validate(address);
  return { ...result, provider: providerId };
}

/**
 * Normalize an address for checkout/session persistence.
 *
 * @param {object} addr
 * @param {{ strict?: boolean }} [options]
 */
export async function normalizeAddressForSession(
  addr,
  { strict = false } = {}
) {
  if (!hasMinimumAddressFields(addr)) {
    if (strict) {
      throw new Error('Please check your shipping address.');
    }
    return { normalizedAddr: addr, validation: null, hasAddress: false };
  }

  try {
    const validation = await validateAddress(addr);
    if (validation.valid) {
      return {
        normalizedAddr: validation.normalized ?? addr,
        validation,
        hasAddress: true,
      };
    }

    if (strict) {
      throw new Error(formatAddressValidationError(validation));
    }

    return { normalizedAddr: addr, validation, hasAddress: true };
  } catch (err) {
    if (strict) throw err;
    logger.warn(
      { err },
      'Address validation failed — continuing with raw address'
    );
    return { normalizedAddr: addr, validation: null, hasAddress: true };
  }
}

export { _registry };
