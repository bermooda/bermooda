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
 *   createCheckoutSession({ cart, successUrl, cancelUrl })
 *   verifyWebhook(request)
 *   handleWebhookEvent(event)
 *   createRefund({ orderId, amount, reason })
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
// listProviders — return all registered provider ids
// ---------------------------------------------------------------------------

/**
 * List all registered payment provider ids.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(_registry.keys());
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
  }));
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Create a checkout session via the named provider.
 *
 * @param {string} providerId
 * @param {{ cart: Object, successUrl: string, cancelUrl: string }} params
 * @returns {Promise<Object>}
 */
export function createCheckoutSession(providerId, params) {
  const provider = getProvider(providerId);
  return provider.createCheckoutSession(params);
}

/**
 * Verify a webhook request via the named provider.
 * Returns { event, rawBody }.
 *
 * @param {string} providerId
 * @param {Request} request
 * @returns {Promise<{ event: Object, rawBody: string }>}
 */
export function verifyWebhook(providerId, request) {
  const provider = getProvider(providerId);
  return provider.verifyWebhook(request);
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { _registry };
