// app/core/plugins/define.server.js
// Define helpers for plugin manifests. Kept separate from registry.server so
// eager plugin discovery cannot circular-import an unfinished barrel re-export
// of these functions (same pattern as `#/core/themes/define`).

/** @type {readonly string[]} */
export const PROVIDER_TYPES = Object.freeze([
  'payment',
  'shipping',
  'tax',
  'search',
  'address_validation',
  'email',
]);

/**
 * Validates plugin runtime configuration and returns it.
 *
 * @param {Record<string, unknown>} runtime
 * @returns {Record<string, unknown>}
 */
export function definePlugin(runtime) {
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('Plugin manifest must be an object');
  }

  if (runtime.providers) {
    defineProviders(
      /** @type {Record<string, { type: string } & Object>} */ (
        runtime.providers
      )
    );
  }

  return runtime;
}

/**
 * Returns a validated hooks object.
 * Values must be functions.
 *
 * @param {Record<string, Function>} hookMap
 * @returns {Record<string, Function>}
 */
export function defineHooks(hookMap) {
  if (!hookMap || typeof hookMap !== 'object') {
    throw new Error('hookMap must be an object');
  }

  for (const [event, handler] of Object.entries(hookMap)) {
    if (typeof handler !== 'function') {
      throw new Error(
        `Hook "${event}" must be a function, got ${typeof handler}`
      );
    }
  }

  return hookMap;
}

/**
 * Returns a typed provider spec object.
 *
 * @param {'payment' | 'shipping' | 'tax' | 'search' | 'address_validation' | 'email'} type
 * @param {Object} spec
 * @returns {{ type: string } & Object}
 */
export function defineProvider(type, spec) {
  if (!PROVIDER_TYPES.includes(type)) {
    throw new Error(
      `Invalid provider type "${type}". Must be one of: ${PROVIDER_TYPES.join(', ')}`
    );
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('Provider spec must be an object');
  }

  return { type, ...spec };
}

/**
 * Returns a validated providers object.
 * Values must be provider specs created with `defineProvider()`.
 *
 * @param {Record<string, { type: string } & Object>} providerMap
 * @returns {Record<string, { type: string } & Object>}
 */
export function defineProviders(providerMap) {
  if (!providerMap || typeof providerMap !== 'object') {
    throw new Error('providerMap must be an object');
  }

  for (const [providerId, spec] of Object.entries(providerMap)) {
    if (!spec || typeof spec !== 'object') {
      throw new Error(`Provider "${providerId}" must be an object`);
    }
    if (!PROVIDER_TYPES.includes(spec.type)) {
      throw new Error(
        `Provider "${providerId}" has invalid type "${spec.type}". Must be one of: ${PROVIDER_TYPES.join(', ')}`
      );
    }
  }

  return providerMap;
}
