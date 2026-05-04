// app/core/i18n/index.server.js
// Server-side i18n resolver: locale negotiation, message catalog merging,
// translation lookup, and cookie helpers.

import { readFileSync } from 'fs';
import { join } from 'path';

import { getCachedResult } from '#/utils/cache.server';
import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

// Absolute path to the app/ directory — works in both dev and production.
const APP_DIR = new URL('../../../app', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// loadMessages(locale)
// ---------------------------------------------------------------------------

/**
 * Loads and merges message catalogs for the given locale from three sources
 * (in ascending priority order):
 *   1. app/core/i18n/messages/<locale>.json  — core messages
 *   2. app/themes/<activeTheme>/i18n/<locale>.json  — active theme overrides
 *   3. app/plugins/<pluginId>/i18n/<locale>.json  — each enabled plugin
 *
 * Missing files are silently skipped. The merged result is TTL-cached.
 *
 * @param {string} locale  e.g. 'en', 'de'
 * @returns {Promise<Record<string, any>>}
 */
export async function loadMessages(locale) {
  return getCachedResult(`i18n:${locale}`, async () => {
    const [activeTheme, pluginOrder] = await Promise.all([
      settingsGet('activeTheme'),
      settingsGet('pluginOrder'),
    ]);

    const plugins = Array.isArray(pluginOrder) ? pluginOrder : [];
    const theme = activeTheme ?? null;

    const filePaths = [
      // 1. Core messages
      join(APP_DIR, 'core', 'i18n', 'messages', `${locale}.json`),
      // 2. Active theme overrides
      ...(theme
        ? [join(APP_DIR, 'themes', theme, 'i18n', `${locale}.json`)]
        : []),
      // 3. Plugin overrides (in pluginOrder order)
      ...plugins.map((pluginId) =>
        join(APP_DIR, 'plugins', pluginId, 'i18n', `${locale}.json`)
      ),
    ];

    let merged = {};
    for (const filePath of filePaths) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        merged = deepMerge(merged, parsed);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          // Re-throw unexpected errors (e.g. parse errors, permission denied).
          throw err;
        }
        // ENOENT — file doesn't exist, skip silently.
      }
    }

    return merged;
  });
}

// ---------------------------------------------------------------------------
// getRequestLocale(request)
// ---------------------------------------------------------------------------

/**
 * Resolves the locale for an incoming request via the following chain:
 *   1. `locale` cookie value
 *   2. Customer preferredLocale from session (TODO: wire up better-auth session)
 *   3. Accept-Language header negotiation (first tag, region stripped)
 *   4. `defaultLocale` setting
 *
 * @param {Request} request
 * @returns {Promise<string>}  locale code, e.g. 'en'
 */
export async function getRequestLocale(request) {
  // 1. locale cookie
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieLocale = parseCookieLocale(cookieHeader);
  if (cookieLocale) return cookieLocale;

  // 2. Customer preferredLocale from session
  // TODO: wire up better-auth session once auth is set up; return null for now.
  const sessionLocale = null;
  if (sessionLocale) return sessionLocale;

  // 3. Accept-Language negotiation
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  const negotiatedLocale = parseAcceptLanguage(acceptLanguage);
  if (negotiatedLocale) return negotiatedLocale;

  // 4. Default locale from settings
  const defaultLocale = await settingsGet('defaultLocale');
  return defaultLocale ?? 'en';
}

// ---------------------------------------------------------------------------
// setLocaleCookie(response, locale)
// ---------------------------------------------------------------------------

/**
 * Appends a `Set-Cookie: locale=<locale>; Path=/; SameSite=Lax` header to
 * the given Response object.
 *
 * @param {Response} response
 * @param {string} locale
 */
export function setLocaleCookie(response, locale) {
  response.headers.append(
    'Set-Cookie',
    `locale=${locale}; Path=/; SameSite=Lax`
  );
}

// ---------------------------------------------------------------------------
// t(key, params, messages)
// ---------------------------------------------------------------------------

/**
 * Looks up a translation key in the provided messages object.
 *
 * Supports dot-notation: `t('cart.empty', {}, messages)` resolves
 * `messages['cart']['empty']` or falls back to `messages['cart.empty']`.
 *
 * If `params` is provided, replaces `{varName}` placeholders in the result.
 *
 * Returns `key` if the translation is not found (graceful degradation).
 *
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @param {Record<string, any>} [messages]
 * @returns {string}
 */
export function t(key, params = {}, messages = {}) {
  const value = resolveKey(key, messages);

  if (typeof value !== 'string') return key;

  if (params && Object.keys(params).length > 0) {
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : `{${name}}`
    );
  }

  return value;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parses a cookie header string and returns the value of the `locale` cookie,
 * or null if absent / empty.
 *
 * @param {string} cookieHeader
 * @returns {string|null}
 */
function parseCookieLocale(cookieHeader) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.split('=');
    const name = rawName.trim();
    if (name === 'locale') {
      const value = rest.join('=').trim();
      return value || null;
    }
  }

  return null;
}

/**
 * Parses an Accept-Language header and returns the first language tag,
 * normalised to the two-letter primary subtag (e.g. 'en-US' → 'en').
 *
 * @param {string} acceptLanguage
 * @returns {string|null}
 */
function parseAcceptLanguage(acceptLanguage) {
  if (!acceptLanguage) return null;

  // Accept-Language: en-US,en;q=0.9,de;q=0.8
  const first = acceptLanguage.split(',')[0].trim();
  // Strip quality value (;q=...) if present.
  const tag = first.split(';')[0].trim();
  // Normalise to primary subtag only.
  const primary = tag.split('-')[0].split('_')[0].toLowerCase();

  return primary || null;
}

/**
 * Resolves a dot-notation key against a nested messages object.
 * Tries nested traversal first; falls back to flat key lookup.
 *
 * @param {string} key
 * @param {Record<string, any>} messages
 * @returns {string|undefined}
 */
function resolveKey(key, messages) {
  if (!key || !messages) return undefined;

  // Try nested traversal: 'cart.empty' → messages.cart.empty
  const parts = key.split('.');
  let current = messages;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      current = undefined;
      break;
    }
    current = current[part];
  }

  if (typeof current === 'string') return current;

  // Fallback: flat key lookup
  return typeof messages[key] === 'string' ? messages[key] : undefined;
}

/**
 * Recursively merges `source` into `target`, with `source` values taking
 * precedence. Returns a new object; does not mutate either argument.
 *
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
