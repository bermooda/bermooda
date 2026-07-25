// app/core/extensions/package-meta.js
/** @typedef {{ id: string, title: string, version: string, description?: string, slug: string, settings?: unknown }} ExtensionPackageMeta */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LEGACY_PLUGIN_ID_MAP = {
  'sample-analytics': '@bermooda/sample-analytics',
  'fraud-guard': '@bermooda/fraud-guard',
  'meilisearch': '@bermooda/meilisearch',
};

export const LEGACY_THEME_ID_MAP = {
  default: '@bermooda/theme-default',
};

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Extension package missing required field: "${label}"`);
  }
  return value.trim();
}

/**
 * @param {unknown} pkg
 * @returns {ExtensionPackageMeta}
 */
export function parseExtensionPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Extension package.json must be an object');
  }

  const bermooda =
    /** @type {{ title?: unknown, slug?: unknown, settings?: unknown }} */ (
      /** @type {Record<string, unknown>} */ (pkg).bermooda
    );
  if (!bermooda || typeof bermooda !== 'object') {
    throw new Error(
      'Extension package.json missing required "bermooda" object'
    );
  }

  const id = requireNonEmptyString(
    /** @type {Record<string, unknown>} */ (pkg).name,
    'name'
  );
  const version = requireNonEmptyString(
    /** @type {Record<string, unknown>} */ (pkg).version,
    'version'
  );
  const title = requireNonEmptyString(bermooda.title, 'bermooda.title');
  const slug = requireNonEmptyString(bermooda.slug, 'bermooda.slug');

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Extension package bermooda.slug must be lowercase hyphenated, got "${slug}"`
    );
  }

  /** @type {ExtensionPackageMeta} */
  const meta = { id, version, title, slug };

  const description = /** @type {Record<string, unknown>} */ (pkg).description;
  if (typeof description === 'string' && description.trim()) {
    meta.description = description.trim();
  }
  if (bermooda.settings !== undefined) {
    meta.settings = bermooda.settings;
  }

  return meta;
}

/**
 * @param {unknown} pkg
 * @param {Record<string, unknown>} [runtime]
 * @returns {Record<string, unknown>}
 */
export function mergeExtensionPackage(pkg, runtime = {}) {
  const meta = parseExtensionPackage(pkg);
  return {
    ...runtime,
    ...meta,
    settings: meta.settings ?? runtime.settings,
  };
}

/**
 * @param {string[]} ids
 * @param {Record<string, string>} map
 * @returns {string[]}
 */
export function normalizeLegacyIds(ids, map) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => map[id] ?? id);
}

/**
 * @param {string} slug
 * @param {string} folderName
 * @param {string} kind
 */
export function assertSlugMatchesFolder(slug, folderName, kind) {
  if (slug !== folderName) {
    throw new Error(
      `${kind} folder "${folderName}" must match bermooda.slug "${slug}"`
    );
  }
}
