// app/core/tax/index.server.js
// Tax provider registry + built-in simple-percent adapter.

import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Default tax config (used when 'tax.config' setting is absent)
// ---------------------------------------------------------------------------

const DEFAULT_TAX_CONFIG = {
  mode: 'exclusive',
  regions: [{ country: 'AU', rate: 0.1 }],
};

// ---------------------------------------------------------------------------
// Registry — in-memory store of registered tax providers
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();

// ---------------------------------------------------------------------------
// registerProvider — add a provider to the registry
// ---------------------------------------------------------------------------

/**
 * Register a tax provider under the given id.
 *
 * A provider must expose:
 *   compute({ subtotalCents, shippingCents, shippingAddress, currency }): Promise<{ taxCents: number, rate: number }>
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

// ---------------------------------------------------------------------------
// getProvider — retrieve a provider by id (throws if not found)
// ---------------------------------------------------------------------------

/**
 * Get a registered tax provider by id.
 * Throws if the provider is not found.
 *
 * @param {string} id
 * @returns {Object}
 */
export function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Tax provider "${id}" is not registered`);
  }
  return provider;
}

// ---------------------------------------------------------------------------
// listProviders — return all registered provider ids
// ---------------------------------------------------------------------------

/**
 * List all registered tax provider ids.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(_registry.keys());
}

// ---------------------------------------------------------------------------
// computeTax — compute tax using a specific provider
// ---------------------------------------------------------------------------

/**
 * Compute tax for a checkout using the specified provider.
 *
 * @param {string} providerId
 * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string }} params
 * @returns {Promise<{ taxCents: number, rate: number, provider: string }>}
 */
export async function computeTax(
  providerId,
  { subtotalCents, shippingCents, shippingAddress, currency }
) {
  const provider = getProvider(providerId);
  const result = await provider.compute({
    subtotalCents,
    shippingCents,
    shippingAddress,
    currency,
  });
  return { ...result, provider: providerId };
}

// ---------------------------------------------------------------------------
// computeActiveTax — compute tax using the active provider from settings
// ---------------------------------------------------------------------------

/**
 * Compute tax using the active provider, read from Setting 'tax.provider'.
 * Defaults to 'simple_percent' if the setting is not present.
 *
 * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string }} params
 * @returns {Promise<{ taxCents: number, rate: number, provider: string }>}
 */
export async function computeActiveTax({
  subtotalCents,
  shippingCents,
  shippingAddress,
  currency,
}) {
  const providerId = (await settingsGet('tax.provider')) ?? 'simple_percent';
  return computeTax(providerId, {
    subtotalCents,
    shippingCents,
    shippingAddress,
    currency,
  });
}

// ---------------------------------------------------------------------------
// simplePercentProvider — built-in provider reading config from settings
// ---------------------------------------------------------------------------

/**
 * Built-in simple-percent tax provider.
 * Reads tax configuration from the 'tax.config' setting.
 */
export const simplePercentProvider = {
  /**
   * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string }} params
   * @returns {Promise<{ taxCents: number, rate: number }>}
   */
  async compute({ subtotalCents, shippingCents, shippingAddress }) {
    const config = (await settingsGet('tax.config')) ?? DEFAULT_TAX_CONFIG;
    const { mode, regions } = config;

    const country = shippingAddress?.country;
    const state = shippingAddress?.state;

    // Find matching region: exact match on country + state wins over country-only
    let matchedRegion = null;

    if (country) {
      // First pass: look for country + state exact match
      if (state) {
        matchedRegion =
          regions.find((r) => r.country === country && r.state === state) ??
          null;
      }

      // Second pass: fall back to country-only (no state specified in region)
      if (!matchedRegion) {
        matchedRegion =
          regions.find((r) => r.country === country && !r.state) ?? null;
      }
    }

    // No match — zero tax
    if (!matchedRegion) {
      return { taxCents: 0, rate: 0 };
    }

    const rate = matchedRegion.rate;
    const base = subtotalCents + shippingCents;

    let taxCents;
    if (mode === 'inclusive') {
      // Prices already include tax — extract it
      taxCents = Math.round((base * rate) / (1 + rate));
    } else {
      // exclusive: add tax on top
      taxCents = Math.round(base * rate);
    }

    return { taxCents, rate };
  },
};

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };
