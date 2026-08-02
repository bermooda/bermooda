// app/core/address-validation/index.server.js
// Pluggable address validation provider registry.

import logger from '#/utils/logger.server';
import { DEFAULT_ADDRESS_VALIDATION_PROVIDER } from '#/core/address-validation/input';
import { getProvider } from '#/core/address-validation/registry.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

export {
  DEFAULT_ADDRESS_VALIDATION_PROVIDER,
  parseAddressValidationSettingsInput,
} from '#/core/address-validation/input';
export {
  _registry,
  listProvidersWithDetails,
  noopProvider,
  registerProvider,
  resolveAddressValidationProvider,
  unregisterProvider,
} from '#/core/address-validation/registry.server';

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
 * Parse and validate address payload shape from a public/admin API body.
 *
 * @param {object} body
 * @returns {object}
 */
export function parseValidatedAddressInput(body = {}) {
  const address = body.address ?? body;
  if (!hasMinimumAddressFields(address)) {
    throw Object.assign(
      new Error('Address must include line1, city, and country'),
      { code: 'ADDRESS_FIELDS_REQUIRED', status: 400 }
    );
  }
  return address;
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
