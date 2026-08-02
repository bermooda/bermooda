// app/core/address-validation/registry.server.js
// Provider registry leaf — no settings imports (avoids settings↔domain cycles).

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
 */
export function unregisterProvider(id) {
  _registry.delete(id);
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

/**
 * Validate provider id from admin/API settings payloads.
 *
 * @param {string} providerId
 * @returns {string}
 */
export function resolveAddressValidationProvider(providerId) {
  const normalized = String(providerId ?? '').trim();
  if (!normalized || !_registry.has(normalized)) {
    throw new Error(`Unknown address validation provider "${providerId}"`);
  }
  return normalized;
}

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

export { _registry };
