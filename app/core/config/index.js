// app/core/config/index.js
// Runtime app config derived from root bermooda.config.js at module load.
// Other packages import this module — not #bermooda.config directly.

import rootConfig from '#bermooda.config';

/**
 * @typedef {Object} RootConfig
 * @property {string} [baseUrl]
 * @property {string} [appName]
 * @property {string} [appDescription]
 * @property {Record<string, any>} [auth]
 * @property {Record<string, any>} [stripe]
 * @property {Record<string, any>} [resend]
 */

/**
 * @typedef {RootConfig & { baseUrl: string }} AppConfig
 */

const DEV_BASE_URL = 'http://localhost:3000';

/**
 * Resolve the public site base URL.
 *
 * - Uses `root.baseUrl` when set (overrides the auto-dev URL).
 * - Outside production, defaults to http://localhost:3000 when unset.
 * - In production, `root.baseUrl` is required.
 *
 * @param {RootConfig | Record<string, unknown> | null | undefined} root
 * @param {{ nodeEnv?: string }} [options]
 * @returns {string}
 */
export function resolveBaseUrl(root, options = {}) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const raw = root?.baseUrl;
  const configured =
    typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (nodeEnv !== 'production') {
    return DEV_BASE_URL;
  }

  throw new Error(
    'bermooda.config.js: `baseUrl` is required when NODE_ENV is "production"'
  );
}

/**
 * Build the runtime config object from a root bermooda.config.js export.
 *
 * @param {RootConfig | Record<string, unknown>} root
 * @param {{ nodeEnv?: string }} [options]
 * @returns {AppConfig}
 */
export function createConfig(root, options = {}) {
  return /** @type {AppConfig} */ ({
    ...root,
    baseUrl: resolveBaseUrl(root, options),
  });
}

/** @type {AppConfig} */
const config = createConfig(rootConfig);

export default config;
