// app/core/tax/input.js
// Pure tax settings parsing — no settings imports (avoids settings↔tax cycles).

export const DEFAULT_TAX_MODE = 'exclusive';

export const DEFAULT_TAX_REGIONS = [{ country: 'AU', percent: 10 }];

/**
 * Normalize a tax region from admin settings or legacy shapes.
 *
 * @param {{ country?: string, state?: string, region?: string, percent?: number|string, rate?: number }} region
 * @param {number} [index]
 * @returns {{ country: string, state: string|null, percent: number }}
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
 * @returns {{ mode: string, regions: object[] }}
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
 * Parse admin/API tax settings payload.
 *
 * @param {{
 *   taxRegions?: object[]|string,
 *   regions?: object[]|string,
 *   taxMode?: string,
 *   mode?: string,
 * }} [input]
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
