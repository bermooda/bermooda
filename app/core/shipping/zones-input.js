// app/core/shipping/zones-input.js
// Pure shipping-zone parsing — no settings imports (avoids settings↔shipping cycles).

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

/**
 * @param {string|null|undefined} name
 * @returns {string}
 */
function slugifyZoneName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Normalize a shipping zone from settings or defaults.
 *
 * @param {{
 *   id?: string,
 *   label?: string,
 *   name?: string,
 *   countries?: string[],
 *   rateCents?: number,
 *   freeOverCents?: number|string|null,
 *   estimatedDays?: number|null,
 * }} zone
 * @param {number} [index]
 * @returns {{
 *   id: string,
 *   name: string,
 *   countries: string[],
 *   rateCents: number,
 *   freeOverCents: number|null,
 *   estimatedDays: number|null,
 * }}
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
 * Parse admin/API shipping zone payload into normalized zone objects.
 *
 * @param {object[]|string} raw
 * @returns {object[]}
 */
export function parseAdminShippingZonesInput(raw) {
  let zones = [];

  if (Array.isArray(raw)) {
    zones = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) zones = parsed;
    } catch {
      zones = [];
    }
  }

  return zones.map((zone, index) => {
    const trimmedName = zone.name?.trim() ?? zone.label?.trim() ?? '';
    const slug = slugifyZoneName(trimmedName) || `zone_${index}`;

    const countries =
      typeof zone.countries === 'string'
        ? zone.countries
            .split(',')
            .map((country) => country.trim().toUpperCase())
            .filter(Boolean)
        : zone.countries;

    return normalizeShippingZone(
      {
        ...zone,
        id: zone.id || slug,
        name: trimmedName,
        countries,
        rateCents: parseInt(zone.rateCents, 10) || 0,
        freeOverCents:
          zone.freeOverCents !== '' && zone.freeOverCents != null
            ? parseInt(zone.freeOverCents, 10) || null
            : null,
        estimatedDays:
          zone.estimatedDays !== '' && zone.estimatedDays != null
            ? parseInt(zone.estimatedDays, 10) || null
            : null,
      },
      index
    );
  });
}
