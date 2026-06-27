import logger from '#/utils/logger.server';
import { SEVERITY } from '#/libs/alerting-types.server';
import { createTelegramAlertProvider } from '#/libs/alerting/telegram.server';

/** @type {Map<string, import('#/libs/alerting-types.server').AlertProvider>} */
const _registry = new Map();

let _builtinsRegistered = false;

/**
 * Register an error alert provider.
 *
 * Providers must expose:
 *   sendError(errorData, options?) => Promise<boolean>
 *
 * @param {string} id
 * @param {import('#/libs/alerting-types.server').AlertProvider} provider
 */
export function registerProvider(id, provider) {
  if (!id || typeof id !== 'string') {
    throw new Error('Alert provider id must be a non-empty string');
  }

  if (!provider || typeof provider !== 'object') {
    throw new Error('Alert provider must be an object');
  }

  if (typeof provider.sendError !== 'function') {
    throw new Error(`Alert provider "${id}" must implement sendError()`);
  }

  _registry.set(id, { ...provider, id });
}

/**
 * Get a registered alert provider by id.
 *
 * @param {string} id
 * @returns {import('#/libs/alerting-types.server').AlertProvider}
 */
export function getProvider(id) {
  const provider = _registry.get(id);

  if (!provider) {
    throw new Error(`Alert provider "${id}" is not registered`);
  }

  return provider;
}

/**
 * List all registered alert provider ids.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(_registry.keys());
}

/**
 * Resolve the configured alert provider from environment variables.
 *
 * @returns {import('#/libs/alerting-types.server').AlertProvider}
 */
export function getActiveProvider() {
  ensureBuiltinProviders();

  const providerId = process.env.ERROR_ALERT_PROVIDER || 'telegram';
  return getProvider(providerId);
}

/**
 * Send an error alert through the configured provider.
 *
 * @param {import('#/libs/alerting-types.server').ErrorAlert|string|Error} errorData
 * @param {import('#/libs/alerting-types.server').AlertOptions} [options]
 * @returns {Promise<boolean>}
 */
export async function sendErrorAlert(errorData, options = {}) {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (process.env.ERROR_ALERTS_ENABLED === 'false') {
    return false;
  }

  try {
    const provider = getActiveProvider();
    return await provider.sendError(errorData, options);
  } catch (error) {
    logger.error(error, 'Failed to send error alert');
    return false;
  }
}

function ensureBuiltinProviders() {
  if (_builtinsRegistered) {
    return;
  }

  _builtinsRegistered = true;
  registerProvider('telegram', createTelegramAlertProvider());
}

/** Reset registry state. Test use only — never call in production. */
export function __resetAlertingRegistry() {
  _registry.clear();
  _builtinsRegistered = false;
}

export { SEVERITY };
