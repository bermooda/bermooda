// app/core/config/index.js
// Runtime app config derived from root bermooda.config.js at module load.
// Other packages import this module — not #bermooda.config directly.

import rootConfig from '#bermooda.config';

import { readEnv } from '#/core/config/env';
import { resolveDevPort } from '#/core/config/port';

export { DEFAULT_DEV_PORT, resolveDevPort } from '#/core/config/port';

/** Hardcoded platform brand for admin chrome and auth product naming. */
export const PLATFORM_NAME = 'bermooda';

/**
 * Dual-auth path/cookie defaults owned by core (not merchant-editable root config).
 *
 * @type {{
 *   adminCookiePrefix: string,
 *   customerCookiePrefix: string,
 *   adminBasePath: string,
 *   customerBasePath: string,
 *   adminCallbackUrl: string,
 *   customerCallbackUrl: string,
 * }}
 */
export const DEFAULT_AUTH = {
  adminCookiePrefix: 'bermooda_admin_',
  customerCookiePrefix: 'bermooda_customer_',
  adminBasePath: '/admin/auth',
  customerBasePath: '/account/auth',
  adminCallbackUrl: '/admin/dashboard',
  customerCallbackUrl: '/account',
};

/**
 * @typedef {Object} AuthConfig
 * @property {string} adminCookiePrefix
 * @property {string} customerCookiePrefix
 * @property {string} adminBasePath
 * @property {string} customerBasePath
 * @property {string} adminCallbackUrl
 * @property {string} customerCallbackUrl
 */

/**
 * @typedef {Object} EmailConfig
 * @property {string} [fromNoReply]
 */

/**
 * @typedef {Object} RootConfig
 * @property {string} [baseUrl]
 * @property {Partial<AuthConfig>} [auth]
 * @property {EmailConfig} [email]
 */

/**
 * @typedef {Object} AppConfig
 * @property {string} baseUrl
 * @property {AuthConfig} auth
 * @property {EmailConfig} email
 */

/**
 * Resolve the public site base URL.
 *
 * - Uses `root.baseUrl` when set (overrides the auto-dev URL).
 * - Outside production, defaults to `http://localhost:${PORT}` when unset
 *   (`PORT` env, else 3000). Matches Vite `server.port`.
 * - In production, `root.baseUrl` is required.
 *
 * @param {RootConfig | Record<string, unknown> | null | undefined} root
 * @param {{ nodeEnv?: string, port?: string | number | null }} [options]
 * @returns {string}
 */
export function resolveBaseUrl(root, options = {}) {
  const nodeEnv = options.nodeEnv ?? readEnv('NODE_ENV');
  const raw = root?.baseUrl;
  const configured =
    typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (nodeEnv !== 'production') {
    return `http://localhost:${resolveDevPort(options)}`;
  }

  throw new Error(
    'bermooda.config.js: `baseUrl` is required when NODE_ENV is "production"'
  );
}

/**
 * Build the runtime config object from a root bermooda.config.js export.
 * Auth defaults live in this module; root may optionally override them.
 *
 * @param {RootConfig | Record<string, unknown>} root
 * @param {{ nodeEnv?: string, port?: string | number | null }} [options]
 * @returns {AppConfig}
 */
export function createConfig(root, options = {}) {
  const authOverride =
    root &&
    typeof root === 'object' &&
    root.auth &&
    typeof root.auth === 'object'
      ? /** @type {Partial<AuthConfig>} */ (root.auth)
      : {};
  const email =
    root &&
    typeof root === 'object' &&
    root.email &&
    typeof root.email === 'object'
      ? /** @type {EmailConfig} */ (root.email)
      : {};

  return {
    baseUrl: resolveBaseUrl(root, options),
    auth: { ...DEFAULT_AUTH, ...authOverride },
    email,
  };
}

/** @type {AppConfig} */
const config = createConfig(rootConfig);

export default config;
