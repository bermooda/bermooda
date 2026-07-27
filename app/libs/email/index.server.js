import logger from '#/utils/logger.server';
import { createResendEmailProvider } from '#/libs/email/resend.server';
import { createSendGridEmailProvider } from '#/libs/email/sendgrid.server';
import { createSesEmailProvider } from '#/libs/email/ses.server';

/** @type {Map<string, import('#/libs/email-types.server').EmailProvider>} */
const _registry = new Map();

let _builtinsRegistered = false;

export const DEFAULT_EMAIL_PROVIDER = 'resend';

/**
 * Register an email transport provider.
 *
 * Providers must expose:
 *   send(message) => Promise<{ success, data?, id? }>
 *
 * @param {string} id
 * @param {import('#/libs/email-types.server').EmailProvider} provider
 */
export function registerProvider(id, provider) {
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
}

/**
 * Remove a registered email provider by id.
 *
 * @param {string} id
 */
export function unregisterProvider(id) {
  _registry.delete(id);
}

/**
 * Whether a provider id is currently registered.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function hasProvider(id) {
  ensureBuiltinProviders();
  return _registry.has(id);
}

/**
 * Get a registered email provider by id.
 *
 * @param {string} id
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function getProvider(id) {
  ensureBuiltinProviders();

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
  ensureBuiltinProviders();

  const normalized = String(providerId || '').trim();
  if (!normalized || !_registry.has(normalized)) {
    throw new Error(`Unknown email provider "${providerId}"`);
  }
  return normalized;
}

/**
 * List registered email providers for admin or diagnostics.
 *
 * @returns {Array<{ id: string, name: string }>}
 */
export function listProvidersWithDetails() {
  ensureBuiltinProviders();

  return Array.from(_registry.values()).map((provider) => ({
    id: provider.id,
    name: provider.name || provider.id,
  }));
}

/**
 * Resolve the configured email provider id from the environment.
 * Settings may override this at the emails facade layer.
 *
 * @returns {string}
 */
export function getConfiguredProviderId() {
  const fromEnv = process.env.EMAIL_PROVIDER?.trim();
  return fromEnv || DEFAULT_EMAIL_PROVIDER;
}

/**
 * Resolve the active email provider (env / default).
 * Prefer {@link sendEmail} with an explicit `providerId` when settings apply.
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function getActiveProvider() {
  return getProvider(getConfiguredProviderId());
}

/**
 * Send an email through a registered provider.
 *
 * @param {import('#/libs/email-types.server').EmailMessage} message
 * @param {{ providerId?: string }} [options]
 * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
 */
export async function sendEmail(message, options = {}) {
  ensureBuiltinProviders();

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
    : getConfiguredProviderId();

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

function ensureBuiltinProviders() {
  if (_builtinsRegistered) {
    return;
  }

  _builtinsRegistered = true;
  registerProvider('resend', createResendEmailProvider());
  registerProvider('sendgrid', createSendGridEmailProvider());
  registerProvider('ses', createSesEmailProvider());
}

/** Reset registry state. Test use only — never call in production. */
export function __resetEmailRegistry() {
  _registry.clear();
  _builtinsRegistered = false;
}
