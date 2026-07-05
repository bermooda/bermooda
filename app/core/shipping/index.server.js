// app/core/shipping/index.server.js
// Shipping provider registry + built-in flat-rate adapter.

import { summarizeCartLines } from '#/core/cart/lines';
import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Default shipping zones (used when 'shipping.zones' setting is absent/empty)
// ---------------------------------------------------------------------------

export const DEFAULT_ZONES = [
  {
    id: 'domestic',
    name: 'Domestic Shipping',
    countries: ['AU'],
    rateCents: 1500,
    freeOverCents: 10000,
    estimatedDays: 5,
  },
  {
    id: 'international',
    name: 'International Shipping',
    countries: ['US', 'GB', 'CA', 'NZ'],
    rateCents: 3000,
    freeOverCents: 20000,
    estimatedDays: 14,
  },
];

// ---------------------------------------------------------------------------
// Zone helpers — normalize admin settings and default zone shapes
// ---------------------------------------------------------------------------

function slugifyZoneName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Normalize a shipping zone from settings or defaults.
 *
 * @param {object} zone
 * @param {number} index
 */
export function normalizeShippingZone(zone, index = 0) {
  const name = zone.label ?? zone.name ?? `Zone ${index + 1}`;
  const id = zone.id ?? (slugifyZoneName(name) || `zone_${index}`);

  return {
    id,
    name,
    countries: Array.isArray(zone.countries) ? zone.countries : [],
    rateCents: zone.rateCents ?? 0,
    freeOverCents:
      zone.freeOverCents != null && zone.freeOverCents !== ''
        ? zone.freeOverCents
        : null,
    estimatedDays: zone.estimatedDays ?? null,
  };
}

/**
 * Load configured zones, falling back to defaults when unset or empty.
 *
 * @param {object[]|null|undefined} raw
 * @returns {object[]}
 */
export function loadShippingZones(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_ZONES;
  }
  return raw.map((zone, index) => normalizeShippingZone(zone, index));
}

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
