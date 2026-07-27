// app/core/settings/index.server.js
// Settings service: read-through TTL-cached get/set with seed defaults.

import cache, { getCachedResult } from '#/utils/cache/index.server';
import {
  DEFAULT_EMAIL_PROVIDER,
  resolveEmailProvider,
} from '#/libs/email/index.server';
import prisma from '#/libs/prisma.server';
import {
  parseAddressValidationSettingsInput,
  resolveAddressValidationProvider,
} from '#/core/address-validation/index.server';
import { normalizeLocaleList } from '#/core/i18n/locales';
import {
  parseSeoSettingsInput,
  seoSettingsToKeyValues,
  serializeSeoSettings,
} from '#/core/seo/input';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_STOREFRONT_LOCALES,
  SETTING_DEFAULTS,
} from '#/core/settings/defaults';
import { SETTING_KEYS } from '#/core/settings/keys';
import { parseAdminShippingZonesInput } from '#/core/shipping/index.server';
import { parseTaxSettingsInput } from '#/core/tax/index.server';

export { SETTING_KEYS } from '#/core/settings/keys';
export {
  AVAILABLE_CURRENCIES,
  DEFAULT_CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALES,
  DEFAULT_STOREFRONT_LOCALES,
  SETTING_DEFAULTS,
} from '#/core/settings/defaults';

const CURRENCY_RE = /^[A-Z]{3}$/;

// ---------------------------------------------------------------------------
// Low-level get / set
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

/**
 * Batch-read multiple settings.
 *
 * @param {string[]} keys
 * @returns {Promise<Record<string, any>>}
 */
export async function getMany(keys) {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await get(key)])
  );
  return Object.fromEntries(entries);
}

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

/**
 * Persist multiple settings in parallel.
 *
 * @param {Record<string, any>} values
 * @returns {Promise<void>}
 */
export async function setMany(values) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => set(key, value))
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isValidCurrencyCode(code) {
  return typeof code === 'string' && CURRENCY_RE.test(code);
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
export function normalizeCurrencyList(codes) {
  if (!Array.isArray(codes)) return [...DEFAULT_CURRENCIES];
  const filtered = codes.filter(isValidCurrencyCode);
  return filtered.length > 0 ? filtered : [...DEFAULT_CURRENCIES];
}

// ---------------------------------------------------------------------------
// Domain getters
// ---------------------------------------------------------------------------

/**
 * Enabled storefront currencies from settings.
 *
 * @returns {Promise<string[]>}
 */
export async function getEnabledCurrencies() {
  return normalizeCurrencyList(await get(SETTING_KEYS.CURRENCIES));
}

/**
 * Enabled storefront locales from settings.
 *
 * @returns {Promise<string[]>}
 */
export async function getEnabledLocales() {
  return normalizeLocaleList(await get(SETTING_KEYS.LOCALES));
}

/**
 * Load shop settings used by the admin settings page.
 *
 * @returns {Promise<object>}
 */
export async function getAdminSettingsSnapshot() {
  const values = await getMany([
    SETTING_KEYS.SHOP_NAME,
    SETTING_KEYS.CONTACT_EMAIL,
    SETTING_KEYS.DEFAULT_CURRENCY,
    SETTING_KEYS.DEFAULT_LOCALE,
    SETTING_KEYS.CURRENCIES,
    SETTING_KEYS.LOCALES,
    SETTING_KEYS.TAX_MODE,
    SETTING_KEYS.TAX_REGIONS,
    SETTING_KEYS.SHIPPING_ZONES,
    SETTING_KEYS.SEO_META_TITLE,
    SETTING_KEYS.SEO_META_DESCRIPTION,
    SETTING_KEYS.SEO_OG_IMAGE_URL,
    SETTING_KEYS.SEO_TITLE_TEMPLATE,
    SETTING_KEYS.SEO_ALLOW_INDEXING,
    SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION,
    SETTING_KEYS.SEO_BING_SITE_VERIFICATION,
    SETTING_KEYS.SEO_TWITTER_HANDLE,
    SETTING_KEYS.ADDRESS_VALIDATION_PROVIDER,
    SETTING_KEYS.EMAIL_PROVIDER,
  ]);

  return {
    shopName: values[SETTING_KEYS.SHOP_NAME] ?? '',
    contactEmail: values[SETTING_KEYS.CONTACT_EMAIL] ?? '',
    defaultCurrency: values[SETTING_KEYS.DEFAULT_CURRENCY] ?? DEFAULT_CURRENCY,
    defaultLocale: values[SETTING_KEYS.DEFAULT_LOCALE] ?? 'en',
    currencies: normalizeCurrencyList(values[SETTING_KEYS.CURRENCIES]),
    locales: normalizeLocaleList(
      values[SETTING_KEYS.LOCALES],
      DEFAULT_STOREFRONT_LOCALES
    ),
    taxMode: values[SETTING_KEYS.TAX_MODE] ?? 'exclusive',
    taxRegions: Array.isArray(values[SETTING_KEYS.TAX_REGIONS])
      ? values[SETTING_KEYS.TAX_REGIONS]
      : [],
    shippingZones: Array.isArray(values[SETTING_KEYS.SHIPPING_ZONES])
      ? values[SETTING_KEYS.SHIPPING_ZONES]
      : [],
    addressValidationProvider:
      values[SETTING_KEYS.ADDRESS_VALIDATION_PROVIDER] ?? 'noop',
    emailProvider:
      values[SETTING_KEYS.EMAIL_PROVIDER] ?? DEFAULT_EMAIL_PROVIDER,
    ...serializeSeoSettings(values),
  };
}

// ---------------------------------------------------------------------------
// Input parsers
// ---------------------------------------------------------------------------

/**
 * Parse admin/API general settings payload.
 *
 * @param {object} input
 * @returns {{ shopName: string, contactEmail: string }}
 */
export function parseGeneralSettingsInput(input = {}) {
  return {
    shopName: String(input.shopName ?? '').trim(),
    contactEmail: String(input.contactEmail ?? '').trim(),
  };
}

/**
 * Parse admin/API currency settings payload.
 *
 * @param {object} input
 * @returns {{ defaultCurrency: string, currencies: string[] }}
 */
export function parseCurrencySettingsInput(input = {}) {
  const rawCurrencies = input.currencies;
  const currencies = Array.isArray(rawCurrencies)
    ? rawCurrencies.map(String).filter(isValidCurrencyCode)
    : typeof rawCurrencies === 'string' && rawCurrencies
      ? [rawCurrencies].filter(isValidCurrencyCode)
      : [];

  const normalized = normalizeCurrencyList(currencies);
  let defaultCurrency = String(input.defaultCurrency ?? DEFAULT_CURRENCY);
  if (!normalized.includes(defaultCurrency)) {
    defaultCurrency = normalized[0] ?? DEFAULT_CURRENCY;
  }

  return { defaultCurrency, currencies: normalized };
}

/**
 * Parse admin/API locale settings payload.
 *
 * @param {object} input
 * @returns {{ defaultLocale: string, locales: string[] }}
 */
export function parseLocaleSettingsInput(input = {}) {
  const rawLocales = input.locales;
  const locales = Array.isArray(rawLocales)
    ? rawLocales.map(String)
    : typeof rawLocales === 'string' && rawLocales
      ? [rawLocales]
      : [];

  const normalized = normalizeLocaleList(locales, DEFAULT_STOREFRONT_LOCALES);
  let defaultLocale = String(input.defaultLocale ?? 'en');
  if (!normalized.includes(defaultLocale)) {
    defaultLocale = normalized[0] ?? 'en';
  }

  return { defaultLocale, locales: normalized };
}

/**
 * Parse admin/API settings payload grouped by section.
 *
 * @param {object} body
 * @returns {{ section: string, values: Record<string, unknown> }|null}
 */
export function parseAdminSettingsPatch(body = {}) {
  if (body.general) {
    return {
      section: 'general',
      values: parseGeneralSettingsInput(body.general),
    };
  }

  if (body.currencies) {
    return {
      section: 'currencies',
      values: parseCurrencySettingsInput(body.currencies),
    };
  }

  if (body.locales) {
    return {
      section: 'locales',
      values: parseLocaleSettingsInput(body.locales),
    };
  }

  if (body.seo) {
    const parsed = parseSeoSettingsInput(body.seo);
    if (Object.keys(parsed).length === 0) return null;
    return { section: 'seo', values: parsed };
  }

  if (body.tax) {
    return { section: 'tax', values: parseTaxSettingsInput(body.tax) };
  }

  if (body.shipping) {
    const zones = parseAdminShippingZonesInput(
      body.shipping.zones ?? body.shipping.shippingZones ?? []
    );
    return { section: 'shipping', values: { zones } };
  }

  if (body.addressValidation) {
    return {
      section: 'addressValidation',
      values: parseAddressValidationSettingsInput(body.addressValidation),
    };
  }

  if (body.email) {
    return {
      section: 'email',
      values: parseEmailSettingsInput(body.email),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Save helpers
// ---------------------------------------------------------------------------

export async function saveGeneralSettings(values) {
  const parsed = parseGeneralSettingsInput(values);
  await setMany({
    [SETTING_KEYS.SHOP_NAME]: parsed.shopName,
    [SETTING_KEYS.CONTACT_EMAIL]: parsed.contactEmail,
  });
}

export async function saveCurrencySettings(values) {
  const parsed = parseCurrencySettingsInput(values);
  await setMany({
    [SETTING_KEYS.CURRENCIES]: parsed.currencies,
    [SETTING_KEYS.DEFAULT_CURRENCY]: parsed.defaultCurrency,
  });
}

export async function saveLocaleSettings(values) {
  const parsed = parseLocaleSettingsInput(values);
  await setMany({
    [SETTING_KEYS.LOCALES]: parsed.locales,
    [SETTING_KEYS.DEFAULT_LOCALE]: parsed.defaultLocale,
  });
}

export async function saveSeoSettings(values) {
  const parsed = parseSeoSettingsInput(values);
  const keyValues = seoSettingsToKeyValues(parsed);
  if (Object.keys(keyValues).length === 0) return;
  await setMany(keyValues);
}

export async function saveTaxSettings(values) {
  const parsed = parseTaxSettingsInput(values);
  await setMany({
    [SETTING_KEYS.TAX_MODE]: parsed.mode,
    [SETTING_KEYS.TAX_REGIONS]: parsed.regions,
  });
}

export async function saveShippingSettings(values) {
  const zones = parseAdminShippingZonesInput(
    values.zones ?? values.shippingZones ?? []
  );
  await set(SETTING_KEYS.SHIPPING_ZONES, zones);
}

export async function saveAddressValidationSettings(values) {
  const parsed = parseAddressValidationSettingsInput(values);
  const provider = resolveAddressValidationProvider(parsed.provider);
  await set(SETTING_KEYS.ADDRESS_VALIDATION_PROVIDER, provider);
}

/**
 * Parse admin/API email provider settings payload.
 *
 * @param {object} input
 * @returns {{ provider: string }}
 */
export function parseEmailSettingsInput(input = {}) {
  const provider = String(input.provider ?? input.emailProvider ?? '').trim();
  return {
    provider: provider || DEFAULT_EMAIL_PROVIDER,
  };
}

/**
 * Persist the active email transport provider.
 *
 * @param {object} values
 */
export async function saveEmailSettings(values) {
  const parsed = parseEmailSettingsInput(values);
  const provider = resolveEmailProvider(parsed.provider);
  await set(SETTING_KEYS.EMAIL_PROVIDER, provider);
}

/**
 * Apply a parsed admin/API settings patch.
 *
 * @param {{ section: string, values: object }} patch
 */
export async function applyAdminSettingsPatch({ section, values }) {
  switch (section) {
    case 'general':
      await saveGeneralSettings(values);
      return;
    case 'currencies':
      await saveCurrencySettings(values);
      return;
    case 'locales':
      await saveLocaleSettings(values);
      return;
    case 'seo':
      await saveSeoSettings(values);
      return;
    case 'tax':
      await saveTaxSettings(values);
      return;
    case 'shipping':
      await saveShippingSettings(values);
      return;
    case 'addressValidation':
      await saveAddressValidationSettings(values);
      return;
    case 'email':
      await saveEmailSettings(values);
      return;
    default:
      throw new Error(`Unknown settings section: ${section}`);
  }
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
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing === null) {
      await set(key, value);
    }
  }
}
