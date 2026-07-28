import logger from '#/utils/logger.server';

/** @type {Map<string, import('#/libs/email-types.server').EmailProvider>} */
const _registry = new Map();

/** @type {string | null} */
let _activeProviderId = null;

/**
 * Register an email transport provider.
 *
 * Providers must expose:
 *   send(message) => Promise<{ success, data?, id? }>
 *
 * The first registered provider becomes active unless another is already set.
 *
 * @param {string} id
 * @param {import('#/libs/email-types.server').EmailProvider} provider
 * @param {{ isActive?: boolean }} [options]
 */
export function registerProvider(id, provider, { isActive = false } = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('Email provider id must be a non-empty string');
  }

  if (!provider || typeof provider !== 'object') {
    throw new Error('Email provider must be an object');
  }

  if (typeof provider.send !== 'function') {
    throw new Error(`Email provider "${id}" must implement send()`);
  }

  _registry.set(id, { ...provider, id });

  if (isActive || _activeProviderId === null) {
    _activeProviderId = id;
  }
}

/**
 * Remove a registered email provider by id.
 *
 * @param {string} id
 */
export function unregisterProvider(id) {
  if (!_registry.has(id)) return;

  _registry.delete(id);
  if (_activeProviderId === id) {
    _activeProviderId = _registry.keys().next().value ?? null;
  }
}

/**
 * Whether a provider id is currently registered.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function hasProvider(id) {
  return _registry.has(id);
}

/**
 * Get a registered email provider by id.
 *
 * @param {string} id
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function getProvider(id) {
  const provider = _registry.get(id);

  if (!provider) {
    throw new Error(`Email provider "${id}" is not registered`);
  }

  return provider;
}

/**
 * Validate that a provider id is registered; return the normalized id.
 *
 * @param {string} providerId
 * @returns {string}
 */
export function resolveEmailProvider(providerId) {
  const normalized = String(providerId || '').trim();
  if (!normalized || !_registry.has(normalized)) {
    throw new Error(`Unknown email provider "${providerId}"`);
  }
  return normalized;
}

/**
 * Override the active email provider.
 *
 * @param {string} id
 */
export function setActiveProvider(id) {
  if (!_registry.has(id)) {
    throw new Error(`Email provider "${id}" is not registered`);
  }
  _activeProviderId = id;
}

/**
 * Return the current active provider id, or null when none is set.
 *
 * @returns {string | null}
 */
export function getActiveProviderId() {
  return _activeProviderId;
}

/**
 * List registered email providers for admin or diagnostics.
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
 * Resolve the active email provider (from enabled email plugins).
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function getActiveProvider() {
  if (!_activeProviderId || !_registry.has(_activeProviderId)) {
    throw new Error(
      'No email provider is active. Enable one under Admin → Plugins (Email providers).'
    );
  }

  return getProvider(_activeProviderId);
}

/**
 * Send an email through the active (or explicitly selected) provider.
 *
 * @param {import('#/libs/email-types.server').EmailMessage} message
 * @param {{ providerId?: string }} [options]
 * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
 */
export async function sendEmail(message, options = {}) {
  if (!message || typeof message !== 'object') {
    throw new Error('Email message must be an object');
  }

  if (!message.from || !message.to || !message.subject || !message.html) {
    throw new Error(
      'Email message requires from, to, subject, and html fields'
    );
  }

  const providerId = options.providerId
    ? resolveEmailProvider(options.providerId)
    : getActiveProvider().id;

  const provider = getProvider(providerId);

  try {
    return await provider.send(message);
  } catch (error) {
    logger.error(
      { err: error, providerId, to: message.to, subject: message.subject },
      'Email provider send failed'
    );
    throw error;
  }
}

/** Reset registry state. Test use only — never call in production. */
export function __resetEmailRegistry() {
  _registry.clear();
  _activeProviderId = null;
}
