// app/core/payments/index.server.js
// Payment provider registry — register adapters by id and call through to them.

// ---------------------------------------------------------------------------
// Registry — in-memory store of registered payment providers
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _registry = new Map();

// ---------------------------------------------------------------------------
// registerProvider — add a provider to the registry
// ---------------------------------------------------------------------------

/**
 * Register a payment provider under the given id.
 *
 * A provider must expose:
 *   createCheckoutSession({ cart?, orderId?, amountCents?, currency?, successUrl, cancelUrl })
 *   verifyWebhook(request)
 *   handleWebhookEvent(event)
 *   createRefund({ paymentIntentId, amountCents, reason?, currency? }) — optional
 *
 * @param {string} id
 * @param {Object} provider
 */
export function registerProvider(id, provider) {
  if (!id || typeof id !== 'string') {
    throw new Error('Provider id must be a non-empty string');
  }
  if (!provider || typeof provider !== 'object') {
    throw new Error('Provider must be an object');
  }
  _registry.set(id, provider);
}

/**
 * Remove a registered payment provider by id.
 *
 * @param {string} id
 */
export function unregisterProvider(id) {
  _registry.delete(id);
}

// ---------------------------------------------------------------------------
// getProvider — retrieve a provider by id (throws if not found)
// ---------------------------------------------------------------------------

/**
 * Get a registered payment provider by id.
 * Throws if the provider is not found.
 *
 * @param {string} id
 * @returns {Object}
 */
export function getProvider(id) {
  const provider = _registry.get(id);
  if (!provider) {
    throw new Error(`Payment provider "${id}" is not registered`);
  }
  return provider;
}

// ---------------------------------------------------------------------------
// listProvidersWithDetails — return { id, name }[] for UI consumption
// ---------------------------------------------------------------------------

/**
 * List all registered providers with id and name for UI display.
 * Reads `provider.name` if the provider exposes it, falls back to the id.
 *
 * @returns {{ id: string, name: string }[]}
 */
export function listProvidersWithDetails() {
  return Array.from(_registry.entries()).map(([id, provider]) => ({
    id,
    name: provider.name ?? id,
    requiresRedirect: provider.requiresRedirect !== false,
    supportsPaymentElement: provider.supportsPaymentElement === true,
  }));
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Create a hosted payment session via the named provider.
 *
 * @param {string} providerId
 * @param {{ cart?: Object, orderId?: string, amountCents?: number, currency?: string, successUrl: string, cancelUrl: string }} params
 * @returns {Promise<{ id: string, url: string, manual?: boolean }>}
 */
export function createPaymentSession(providerId, params) {
  const provider = getProvider(providerId);
  return provider.createCheckoutSession(params);
}

/**
 * Create a PaymentIntent via the named provider (Stripe Payment Element).
 *
 * @param {string} providerId
 * @param {object} params
 * @returns {Promise<{ clientSecret: string, paymentIntentId: string }>}
 */
export function createPaymentIntent(providerId, params) {
  const provider = getProvider(providerId);
  if (typeof provider.createPaymentIntent !== 'function') {
    throw new Error(
      `Payment provider "${providerId}" does not support Payment Element`
    );
  }
  return provider.createPaymentIntent(params);
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };
