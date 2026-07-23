import logger from '#/utils/logger.server';
import { SEVERITY } from '#/libs/alerting-types.server';
import { isAlertsEnabled } from '#/libs/alerting/shared/index.server';
import { createTelegramAlertProvider } from '#/libs/alerting/telegram.server';

/** @type {Map<string, import('#/libs/alerting-types.server').AlertProvider>} */
const _registry = new Map();

let _builtinsRegistered = false;

/**
 * Register an error alert provider.
 *
 * Providers must expose:
 *   sendError(errorData, options?) => Promise<boolean>
 * Optional:
 *   sendMessage(message, options?) => Promise<boolean>
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
 * List registered alert providers for admin or diagnostics.
 *
 * @returns {Array<{ id: string, name: string }>}
 */
export function listProvidersWithDetails() {
  return Array.from(_registry.values()).map((provider) => ({
    id: provider.id,
    name: provider.name || provider.id,
  }));
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
  if (!isAlertsEnabled()) {
    return process.env.NODE_ENV === 'development';
  }

  try {
    const provider = getActiveProvider();
    return await provider.sendError(errorData, options);
  } catch (error) {
    logger.error(error, 'Failed to send error alert');
    return false;
  }
}

/**
 * Send a general notification through the configured alert provider.
 *
 * @param {string} message
 * @param {import('#/libs/alerting-types.server').AlertOptions} [options]
 * @returns {Promise<boolean>}
 */
export async function sendAlertMessage(message, options = {}) {
  if (!isAlertsEnabled()) {
    return process.env.NODE_ENV === 'development';
  }

  try {
    const provider = getActiveProvider();

    if (typeof provider.sendMessage !== 'function') {
      logger.warn(
        `Alert provider "${provider.id}" does not implement sendMessage()`
      );
      return false;
    }

    return await provider.sendMessage(message, options);
  } catch (error) {
    logger.error(error, 'Failed to send alert message');
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
