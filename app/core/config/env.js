// app/core/config/env.js
// Environment access that survives the browser bundle.
//
// `#/core/config` is reachable from client code (route modules pull in auth
// paths and the base URL), and `process` does not exist there. Reading it
// unguarded throws at module-eval time, which kills hydration for the whole
// app rather than failing locally. Keep this module side-effect free so
// vite.config.js can import its consumers during a production build.

/**
 * Read an environment variable, or `undefined` when there is no `process`
 * (browser bundles, workers).
 *
 * @param {string} key
 * @returns {string | undefined}
 */
export function readEnv(key) {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[key];
}
