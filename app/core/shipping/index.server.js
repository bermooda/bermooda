// app/core/shipping/index.server.js
// Shipping provider registry + built-in flat-rate adapter.

import { summarizeCartLines } from '#/core/cart/lines';
import { get as settingsGet } from '#/core/settings/index.server';
import { loadShippingZones } from '#/core/shipping/zones-input';

export {
  DEFAULT_ZONES,
  loadShippingZones,
  normalizeShippingZone,
  parseAdminShippingZonesInput,
} from '#/core/shipping/zones-input';

/**
 * Compute flat-rate shipping cents for a zone and cart subtotal.
 *
 * @param {object} zone
 * @param {number} subtotalCents
 */
export function computeZonePriceCents(zone, subtotalCents) {
  if (zone.freeOverCents != null && subtotalCents >= zone.freeOverCents) {
    return 0;
  }
  return zone.rateCents ?? 0;
}

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

function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Shipping provider "${id}" is not registered`);
  }
  return provider;
}

function listProviders() {
  return Array.from(_registry.keys());
}

function getQuotes(providerId, { cart, shippingAddress }) {
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

/**
 * Resolve a shipping option by id from live quotes, with persisted snapshot fallback.
 *
 * @param {{
 *   cart: object,
 *   shippingAddress: object,
 *   optionId?: string,
 *   persistedOption?: object|null,
 * }} params
 * @returns {Promise<{ option: object|null, quotes: object[] }>}
 */
export async function resolveShippingOption({
  cart,
  shippingAddress,
  optionId,
  persistedOption = null,
}) {
  const quotes = await getAllQuotes({ cart, shippingAddress });

  if (!optionId) {
    return { option: null, quotes };
  }

  let option = quotes.find((quote) => quote.id === optionId) ?? null;

  if (
    !option &&
    persistedOption?.id === optionId &&
    typeof persistedOption.priceCents === 'number'
  ) {
    option = persistedOption;
  }

  return { option, quotes };
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
    const zones = loadShippingZones(await settingsGet('shipping.zones'));

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
      name: zone.name,
      priceCents: computeZonePriceCents(zone, subtotal),
      estimatedDays: zone.estimatedDays ?? null,
    }));
  },
};

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry, getProvider, getQuotes, listProviders };
