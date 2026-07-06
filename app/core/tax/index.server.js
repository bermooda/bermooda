// app/core/tax/index.server.js
// Tax provider registry + built-in simple-percent adapter.

import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Default tax config (used when admin tax settings are absent)
// ---------------------------------------------------------------------------

export const DEFAULT_TAX_MODE = 'exclusive';

export const DEFAULT_TAX_REGIONS = [{ country: 'AU', percent: 10 }];

/**
 * Normalize a tax region from admin settings or legacy shapes.
 *
 * @param {object} region
 * @param {number} [index]
 */
export function normalizeTaxRegion(region, index = 0) {
  const country = String(region?.country ?? '').toUpperCase();
  const stateOrRegion = region?.state ?? region?.region ?? null;
  const state =
    stateOrRegion && stateOrRegion !== '*' ? String(stateOrRegion) : null;

  let percent;
  if (region?.percent != null && region.percent !== '') {
    percent = Number(region.percent);
  } else if (region?.rate != null) {
    percent = Number(region.rate) * 100;
  } else {
    percent = 0;
  }

  return {
    country: country || `REGION_${index + 1}`,
    state,
    percent: Number.isFinite(percent) ? percent : 0,
  };
}

/**
 * @param {string|null|undefined} rawMode
 * @param {object[]|null|undefined} rawRegions
 */
export function loadTaxConfig(rawMode, rawRegions) {
  const mode = rawMode === 'inclusive' ? 'inclusive' : 'exclusive';
  const source =
    Array.isArray(rawRegions) && rawRegions.length > 0
      ? rawRegions
      : DEFAULT_TAX_REGIONS;

  return {
    mode,
    regions: source.map((region, index) => normalizeTaxRegion(region, index)),
  };
}

/**
 * Load tax mode and regions from admin settings (`tax.mode`, `tax.regions`).
 */
export async function getTaxConfig() {
  const [mode, regions] = await Promise.all([
    settingsGet('tax.mode'),
    settingsGet('tax.regions'),
  ]);
  return loadTaxConfig(mode, regions);
}

/**
 * Parse admin/API tax settings payload.
 *
 * @param {object} input
 * @returns {{ mode: string, regions: object[] }}
 */
export function parseTaxSettingsInput(input = {}) {
  const rawRegions = input.taxRegions ?? input.regions;
  let regions = [];

  if (Array.isArray(rawRegions)) {
    regions = rawRegions;
  } else if (typeof rawRegions === 'string') {
    try {
      const parsed = JSON.parse(rawRegions);
      if (Array.isArray(parsed)) regions = parsed;
    } catch {
      regions = [];
    }
  }

  return loadTaxConfig(input.taxMode ?? input.mode, regions);
}

/**
 * @param {string|null|undefined} vatId
 */
export function isVatExempt(vatId) {
  return Boolean(vatId && String(vatId).trim().length > 0);
}

/**
 * Resolve the decimal tax rate for a shipping address.
 *
 * @param {{ mode: string, regions: object[] }} config
 * @param {object|null|undefined} shippingAddress
 */
export function resolveRegionRate(config, shippingAddress) {
  const { regions } = config;
  const country = String(shippingAddress?.country ?? '').toUpperCase();
  const state = shippingAddress?.state ?? shippingAddress?.region ?? null;

  if (!country) return 0;

  if (state) {
    const exact = regions.find(
      (region) =>
        region.country === country &&
        region.state &&
        (region.state === state || region.state === '*')
    );
    if (exact) return exact.percent / 100;
  }

  const countryOnly = regions.find(
    (region) => region.country === country && !region.state
  );
  return countryOnly ? countryOnly.percent / 100 : 0;
}

/**
 * @param {{ baseCents: number, rate: number, mode: string }} params
 */
export function computeTaxCents({ baseCents, rate, mode }) {
  if (rate === 0) return 0;
  if (mode === 'inclusive') {
    return Math.round((baseCents * rate) / (1 + rate));
  }
  return Math.round(baseCents * rate);
}

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
 *   compute({ subtotalCents, shippingCents, shippingAddress, currency, vatId? }): Promise<{ taxCents: number, rate: number }>
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

function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Tax provider "${id}" is not registered`);
  }
  return provider;
}

/**
 * Compute tax for a checkout using the specified provider.
 *
 * @param {string} providerId
 * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string, vatId?: string }} params
 * @returns {Promise<{ taxCents: number, rate: number, provider: string }>}
 */
export async function computeTax(
  providerId,
  { subtotalCents, shippingCents, shippingAddress, currency, vatId }
) {
  const provider = getProvider(providerId);
  const result = await provider.compute({
    subtotalCents,
    shippingCents,
    shippingAddress,
    currency,
    vatId,
  });
  return { ...result, provider: providerId };
}

/**
 * Compute tax using the active provider, read from Setting 'tax.provider'.
 * Defaults to 'simple_percent' if the setting is not present.
 *
 * When lines with taxClassId are provided, per-line rates are applied via
 * tax class logic before delegating to the active provider for shipping.
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

  if (lines.length > 0 && lines.some((l) => l.taxClassId || l.taxClassRate)) {
    const lineTax = await computeLineTax({
      lines,
      shippingAddress,
      vatId,
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

async function computeLineTax({ lines, shippingAddress, vatId }) {
  if (isVatExempt(vatId)) {
    return { taxCents: 0, rate: 0 };
  }

  const config = await getTaxConfig();
  const regionRate = resolveRegionRate(config, shippingAddress);

  let taxCents = 0;
  for (const line of lines) {
    const lineSubtotal = line.priceCents * line.quantity;
    const classRate =
      line.taxClassRate && line.taxClassRate > 0
        ? line.taxClassRate
        : regionRate;
    taxCents += computeTaxCents({
      baseCents: lineSubtotal,
      rate: classRate,
      mode: config.mode,
    });
  }

  return { taxCents, rate: regionRate };
}

/**
 * Built-in simple-percent tax provider.
 * Reads tax configuration from admin settings (`tax.mode`, `tax.regions`).
 */
export const simplePercentProvider = {
  /**
   * @param {{ subtotalCents: number, shippingCents: number, shippingAddress: Object, currency: string, vatId?: string }} params
   * @returns {Promise<{ taxCents: number, rate: number }>}
   */
  async compute({ subtotalCents, shippingCents, shippingAddress, vatId }) {
    if (isVatExempt(vatId)) {
      return { taxCents: 0, rate: 0 };
    }

    const config = await getTaxConfig();
    const rate = resolveRegionRate(config, shippingAddress);

    if (rate === 0) {
      return { taxCents: 0, rate: 0 };
    }

    const base = subtotalCents + shippingCents;
    const taxCents = computeTaxCents({
      baseCents: base,
      rate,
      mode: config.mode,
    });

    return { taxCents, rate };
  },
};

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

export { _registry, getProvider };
