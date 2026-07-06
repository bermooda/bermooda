// app/core/settings/index.server.js
// Settings service: read-through TTL-cached get/set with seed defaults.

import cache, { getCachedResult } from '#/utils/cache.server';
import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  defaultCurrency: JSON.stringify('USD'),
  currencies: JSON.stringify(['USD', 'EUR', 'AUD']),
  defaultLocale: JSON.stringify('en'),
  locales: JSON.stringify(['en', 'de', 'fr']),
  activeTheme: JSON.stringify('default'),
  pluginOrder: JSON.stringify([]),
};

// ---------------------------------------------------------------------------
// get — read-through cached lookup
// ---------------------------------------------------------------------------

/**
 * Returns the value for the given setting key, or null if not found.
 * Values are JSON-parsed when possible; raw strings are returned as-is.
 *
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function get(key) {
  const raw = await getCachedResult(`setting:${key}`, async () => {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  });

  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// set — upsert + cache invalidation
// ---------------------------------------------------------------------------

/**
 * Persists the given value for the setting key and invalidates its cache entry.
 *
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function set(key, value) {
  const serialized = JSON.stringify(value);

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });

  cache.delete(`setting:${key}`);
}

// ---------------------------------------------------------------------------
// seedDefaults — write default settings if not already present
// ---------------------------------------------------------------------------

/**
 * Writes each default setting only when the key does not already exist in DB.
 *
 * @returns {Promise<void>}
 */
export async function seedDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing === null) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  }
}
