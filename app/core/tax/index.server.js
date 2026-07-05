// app/core/tax/index.server.js
// Tax provider registry + built-in simple-percent adapter.

import prisma from '#/libs/prisma.server';

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

/**
 * Remove a registered tax provider by id.
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
 * When lines with taxClassId are provided, per-line rates are applied via
 * taxClassProvider logic before delegating to the active provider for shipping.
 *
 * @param {{
 *   subtotalCents: number,
 *   shippingCents: number,
 *   shippingAddress: Object,
 *   currency: string,
 *   lines?: { priceCents: number, quantity: number, taxClassId?: string, taxClassRate?: number }[],
 *   vatId?: string,
 * }} params
 * @returns {Promise<{ taxCents: number, rate: number, provider: string }>}
 */
export async function computeActiveTax({
  subtotalCents,
  shippingCents,
  shippingAddress,
  currency,
  lines = [],
  vatId,
}) {
  const providerId = (await settingsGet('tax.provider')) ?? 'simple_percent';

  // Per-line tax classes: sum line taxes when variant tax classes are present
  if (lines.length > 0 && lines.some((l) => l.taxClassId || l.taxClassRate)) {
    const lineTax = await computeLineTax({
      lines,
      shippingAddress,
    });
    const shippingTax = await computeTax(providerId, {
      subtotalCents: 0,
      shippingCents,
      shippingAddress,
      currency,
      vatId,
    });
    return {
      taxCents: lineTax.taxCents + shippingTax.taxCents,
      rate: lineTax.rate,
      provider: providerId,
    };
  }

  return computeTax(providerId, {
    subtotalCents,
    shippingCents,
    shippingAddress,
    currency,
    vatId,
  });
}

/**
 * Compute tax per cart/order line using tax class rates.
 * Falls back to the active provider's region rate when tax class rate is 0.
 */
async function computeLineTax({ lines, shippingAddress }) {
  const config = (await settingsGet('tax.config')) ?? DEFAULT_TAX_CONFIG;
  const regionRate = resolveRegionRate(config, shippingAddress);

  let taxCents = 0;
  for (const line of lines) {
    const lineSubtotal = line.priceCents * line.quantity;
    const classRate =
      line.taxClassRate && line.taxClassRate > 0
        ? line.taxClassRate
        : regionRate;
    taxCents += Math.round(lineSubtotal * classRate);
  }

  return { taxCents, rate: regionRate };
}

function resolveRegionRate(config, shippingAddress) {
  const { regions } = config;
  const country = shippingAddress?.country;
  const state = shippingAddress?.state;

  if (!country) return 0;

  if (state) {
    const exact = regions.find(
      (r) => r.country === country && r.state === state
    );
    if (exact) return exact.rate;
  }

  const countryOnly = regions.find((r) => r.country === country && !r.state);
  return countryOnly?.rate ?? 0;
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
   * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string, vatId?: string }} params
   * @returns {Promise<{ taxCents: number, rate: number }>}
   */
  async compute({ subtotalCents, shippingCents, shippingAddress, vatId }) {
    const config = (await settingsGet('tax.config')) ?? DEFAULT_TAX_CONFIG;
    const { mode } = config;

    // VAT/GST ID present — zero-rated B2B (simplified; plugins can override)
    if (vatId && vatId.trim().length > 0) {
      return { taxCents: 0, rate: 0 };
    }

    const rate = resolveRegionRate(config, shippingAddress);

    if (rate === 0) {
      return { taxCents: 0, rate: 0 };
    }

    const base = subtotalCents + shippingCents;

    let taxCents;
    if (mode === 'inclusive') {
      taxCents = Math.round((base * rate) / (1 + rate));
    } else {
      taxCents = Math.round(base * rate);
    }

    return { taxCents, rate };
  },
};

// ---------------------------------------------------------------------------
// Automatic tax provider interface (TaxJar / Avalara via plugin)
// ---------------------------------------------------------------------------

/**
 * Stub automatic-tax provider. Plugins register a real implementation that
 * calls external tax APIs. Until then, delegates to simple_percent.
 */
export const automaticTaxProvider = {
  name: 'Automatic Tax (plugin)',

  async compute(params) {
    return simplePercentProvider.compute(params);
  },
};

// ---------------------------------------------------------------------------
// Tax class CRUD
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<object[]>}
 */
export async function listTaxClasses() {
  return prisma.taxClass.findMany({ orderBy: { name: 'asc' } });
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getTaxClass(id) {
  return prisma.taxClass.findUnique({ where: { id } });
}

/**
 * @param {{ name: string, code: string, rate?: number }} data
 */
export async function createTaxClass(data) {
  return prisma.taxClass.create({ data });
}

/**
 * @param {string} id
 * @param {object} data
 */
export async function updateTaxClass(id, data) {
  return prisma.taxClass.update({ where: { id }, data });
}

/**
 * @param {string} id
 */
export async function deleteTaxClass(id) {
  await prisma.taxClass.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };
