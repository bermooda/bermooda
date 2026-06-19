// app/core/address-validation/index.server.js
// Pluggable address validation/autocomplete provider registry.

import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();

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
 * @returns {Object}
 */
export function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Address validation provider "${id}" is not registered`);
  }
  return provider;
}

/**
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(_registry.keys());
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
// Active provider helpers
// ---------------------------------------------------------------------------

/**
 * Validate an address using the active provider from Setting 'addressValidation.provider'.
 * Defaults to 'noop'.
 *
 * @param {object} address
 * @returns {Promise<{ valid: boolean, normalized: object, suggestions: object[], provider: string }>}
 */
export async function validateAddress(address) {
  const providerId =
    (await settingsGet('addressValidation.provider')) ?? 'noop';
  const provider = getProvider(providerId);
  const result = await provider.validate(address);
  return { ...result, provider: providerId };
}

export { _registry };
