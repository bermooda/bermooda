import { REQUIRED_COMPONENTS } from '#/core/themes/manifest';

/**
 * Validates theme runtime config (components only). Identity comes from package.json.
 * @param {Record<string, unknown>} runtime
 * @returns {Record<string, unknown>}
 */
export function defineTheme(runtime) {
  if (runtime === null || typeof runtime !== 'object') {
    throw new TypeError('defineTheme: runtime must be a non-null object');
  }

  const components = runtime.components;
  if (!components || typeof components !== 'object') {
    throw new Error('defineTheme: runtime.components must be an object');
  }

  for (const name of REQUIRED_COMPONENTS) {
    if (!(name in components)) {
      throw new Error(
        `defineTheme: components is missing required component "${name}"`
      );
    }
  }

  return runtime;
}
