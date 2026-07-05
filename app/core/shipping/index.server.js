// app/core/shipping/index.server.js
// Shipping provider registry + built-in flat-rate adapter.

import { summarizeCartLines } from '#/core/cart/lines';
import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Default shipping zones (used when 'shipping.zones' setting is absent)
// ---------------------------------------------------------------------------

const DEFAULT_ZONES = [
  {
    id: 'domestic',
    label: 'Domestic Shipping',
    countries: ['AU'],
    rateCents: 1500,
    freeOverCents: 10000,
    estimatedDays: 5,
  },
  {
    id: 'international',
    label: 'International Shipping',
    countries: ['US', 'GB', 'CA', 'NZ'],
    rateCents: 3000,
    freeOverCents: 20000,
    estimatedDays: 14,
  },
];

// ---------------------------------------------------------------------------
// Registry — in-memory store of registered shipping providers
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();

// ---------------------------------------------------------------------------
// registerProvider — add a provider to the registry
// ---------------------------------------------------------------------------

/**
 * Register a shipping provider under the given id.
 *
 * A provider must expose:
 *   getQuotes({ cart, shippingAddress }): Promise<ShippingOption[]>
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
 * Remove a registered shipping provider by id.
 *
 * @param {string} id
 */
export function unregisterProvider(id) {
  _registry.delete(id);
}

// ---------------------------------------------------------------------------
// getProvider — retrieve a provider by id (throws if not found)
// ---------------------------------------------------------------------------

/**
 * Get a registered shipping provider by id.
 * Throws if the provider is not found.
 *
 * @param {string} id
 * @returns {Object}
 */
export function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Shipping provider "${id}" is not registered`);
  }
  return provider;
}

// ---------------------------------------------------------------------------
// listProviders — return all registered provider ids
// ---------------------------------------------------------------------------

/**
 * List all registered shipping provider ids.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(_registry.keys());
}

// ---------------------------------------------------------------------------
// getQuotes — get quotes from a specific provider
// ---------------------------------------------------------------------------

/**
 * Get shipping quotes from a specific provider.
 *
 * @param {string} providerId
 * @param {{ cart: Object, shippingAddress: Object }} params
 * @returns {Promise<ShippingOption[]>}
 */
export function getQuotes(providerId, { cart, shippingAddress }) {
  const provider = getProvider(providerId);
  return provider.getQuotes({ cart, shippingAddress });
}

// ---------------------------------------------------------------------------
// getAllQuotes — get quotes from ALL registered providers (merged)
// ---------------------------------------------------------------------------

/**
 * Get shipping quotes from all registered providers, merged into a single array.
 *
 * @param {{ cart: Object, shippingAddress: Object }} params
 * @returns {Promise<ShippingOption[]>}
 */
export async function getAllQuotes({ cart, shippingAddress }) {
  const ids = listProviders();
  const results = await Promise.all(
    ids.map((id) => getQuotes(id, { cart, shippingAddress }))
  );
  return results.flat();
}

// ---------------------------------------------------------------------------
// flatRateProvider — built-in provider reading zones from settings
// ---------------------------------------------------------------------------

/**
 * Built-in flat-rate shipping provider.
 * Reads zone configuration from the 'shipping.zones' setting.
 */
export const flatRateProvider = {
  /**
   * @param {{ cart: Object, shippingAddress: Object }} params
   * @returns {Promise<ShippingOption[]>}
   */
  async getQuotes({ cart, shippingAddress }) {
    const zones = (await settingsGet('shipping.zones')) ?? DEFAULT_ZONES;

    const country = shippingAddress?.country;
    const { subtotalCents: subtotal } = summarizeCartLines(cart?.lines);

    const matchingZones = zones.filter(
      (zone) =>
        Array.isArray(zone.countries) && zone.countries.includes(country)
    );

    if (matchingZones.length === 0) {
      return [
        {
          id: 'flat_rate:default',
          providerId: 'flat_rate',
          name: 'Standard Shipping',
          priceCents: 0,
          estimatedDays: null,
        },
      ];
    }

    return matchingZones.map((zone) => ({
      id: `flat_rate:${zone.id}`,
      providerId: 'flat_rate',
      name: zone.label,
      priceCents: subtotal >= zone.freeOverCents ? 0 : zone.rateCents,
      estimatedDays: zone.estimatedDays ?? null,
    }));
  },
};

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };
