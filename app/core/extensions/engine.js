// app/core/extensions/engine.js
import semver from 'semver';

import appPackage from '../../../package.json';

/**
 * Read and validate the bermooda shop version from the root `package.json`.
 * This is the version plugins/themes declare compatibility against via
 * their `bermooda.engine` semver range.
 *
 * @returns {string} A valid semver version, e.g. `"1.0.0"`.
 */
export function getAppVersion() {
  const version = appPackage?.version;
  if (typeof version !== 'string' || !semver.valid(version)) {
    throw new Error(
      'bermooda root package.json must declare a valid semver "version"'
    );
  }
  return version;
}

/**
 * Validate an extension's declared `bermooda.engine` semver range.
 *
 * @param {unknown} engine
 * @returns {string} The trimmed, valid semver range.
 */
export function assertEngineRange(engine) {
  if (typeof engine !== 'string' || engine.trim() === '') {
    throw new Error(
      'Extension package missing required field: "bermooda.engine"'
    );
  }
  const range = engine.trim();
  if (!semver.validRange(range)) {
    throw new Error(
      `Extension package bermooda.engine is not a valid semver range: "${range}"`
    );
  }
  return range;
}

/**
 * @param {string} shopVersion
 * @param {string} engineRange
 * @returns {boolean}
 */
export function isEngineCompatible(shopVersion, engineRange) {
  return semver.satisfies(shopVersion, engineRange);
}

/**
 * @typedef {{ ok: true, engine: string }} EngineCheckOk
 * @typedef {{ ok: false, reason: string }} EngineCheckFail
 */

/**
 * Validate and check an extension's `bermooda.engine` range against the shop
 * version, without throwing. Used for soft-skip behavior at discovery time.
 *
 * @param {Object} opts
 * @param {string} opts.shopVersion
 * @param {unknown} opts.engine
 * @param {'plugin' | 'theme'} opts.kind
 * @param {string} [opts.id]
 * @returns {EngineCheckOk | EngineCheckFail}
 */
export function checkExtensionEngine({ shopVersion, engine, kind, id }) {
  try {
    const range = assertEngineRange(engine);
    if (!isEngineCompatible(shopVersion, range)) {
      const label = id ? `${kind} "${id}"` : kind;
      return {
        ok: false,
        reason: `${label} requires bermooda ${range} (shop is ${shopVersion})`,
      };
    }
    return { ok: true, engine: range };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
