#!/usr/bin/env node
/**
 * Compare English i18n catalogs against de/fr overlays.
 *
 * Checks:
 *   1. app/emails/i18n/*.json (flat keys)
 *   2. app/core/i18n/messages/*.json (flat leaf keys after nested→dotted normalize)
 *
 * Exits non-zero when any locale is missing keys present in `en`.
 *
 * Usage:
 *   node scripts/check-i18n-key-coverage.mjs
 *   npm run check:i18n
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/** @typedef {{ locale: string, missing: string[] }} CoverageIssue */
/** @typedef {{ ok: boolean, label: string, issues: CoverageIssue[] }} CoverageResult */

/**
 * True for plain objects that should be walked as nested message trees.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Collect dotted leaf keys from a catalog value (nested objects or flat maps).
 *
 * @param {unknown} value
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function flattenLeafKeys(value, prefix = '') {
  if (!isPlainObject(value)) {
    return prefix ? [prefix] : [];
  }

  /** @type {string[]} */
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      keys.push(...flattenLeafKeys(child, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/**
 * Keys present in `base` but absent from `locale`.
 *
 * @param {Iterable<string>} baseKeys
 * @param {Iterable<string>} localeKeys
 * @returns {string[]}
 */
export function findMissingKeys(baseKeys, localeKeys) {
  const localeSet = new Set(localeKeys);
  return [...baseKeys].filter((key) => !localeSet.has(key)).sort();
}

/**
 * Load a JSON catalog from disk.
 *
 * @param {string} filePath
 * @returns {unknown}
 */
export function loadJsonCatalog(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Compare `en` leaf keys against each overlay locale in a catalog directory.
 *
 * @param {string} catalogDir Absolute path to a directory of `<locale>.json` files
 * @param {{ label?: string, baseLocale?: string, locales?: string[] }} [options]
 * @returns {CoverageResult}
 */
export function checkCatalogCoverage(catalogDir, options = {}) {
  const label = options.label ?? catalogDir;
  const baseLocale = options.baseLocale ?? 'en';
  const locales = options.locales ?? ['de', 'fr'];

  const basePath = join(catalogDir, `${baseLocale}.json`);
  const baseKeys = flattenLeafKeys(loadJsonCatalog(basePath));

  /** @type {CoverageIssue[]} */
  const issues = [];
  for (const locale of locales) {
    const localePath = join(catalogDir, `${locale}.json`);
    const localeKeys = flattenLeafKeys(loadJsonCatalog(localePath));
    const missing = findMissingKeys(baseKeys, localeKeys);
    if (missing.length > 0) {
      issues.push({ locale, missing });
    }
  }

  return { ok: issues.length === 0, label, issues };
}

/**
 * Default catalog roots relative to the repo root.
 *
 * @param {string} [repoRoot]
 * @returns {{ label: string, dir: string }[]}
 */
export function defaultCatalogTargets(repoRoot = REPO_ROOT) {
  return [
    {
      label: 'emails',
      dir: join(repoRoot, 'app', 'emails', 'i18n'),
    },
    {
      label: 'core messages',
      dir: join(repoRoot, 'app', 'core', 'i18n', 'messages'),
    },
  ];
}

/**
 * Run coverage checks for all default catalogs.
 *
 * @param {string} [repoRoot]
 * @returns {CoverageResult[]}
 */
export function checkAllCatalogs(repoRoot = REPO_ROOT) {
  return defaultCatalogTargets(repoRoot).map(({ label, dir }) =>
    checkCatalogCoverage(dir, { label })
  );
}

/**
 * Format coverage failures for stderr.
 *
 * @param {CoverageResult[]} results
 * @returns {string}
 */
export function formatCoverageFailures(results) {
  /** @type {string[]} */
  const lines = [];
  for (const result of results) {
    if (result.ok) continue;
    lines.push(`Missing keys in ${result.label}:`);
    for (const issue of result.issues) {
      lines.push(`  [${issue.locale}] ${issue.missing.length} missing:`);
      for (const key of issue.missing) {
        lines.push(`    - ${key}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * @param {string} [repoRoot]
 * @returns {number} process exit code
 */
export function main(repoRoot = REPO_ROOT) {
  const targets = defaultCatalogTargets(repoRoot);

  for (const { dir, label } of targets) {
    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    if (files.length === 0) {
      console.error(`check:i18n: no JSON catalogs in ${label} (${dir})`);
      return 1;
    }
  }

  const results = targets.map(({ label, dir }) =>
    checkCatalogCoverage(dir, { label })
  );
  let failed = false;

  for (const result of results) {
    if (result.ok) {
      const target = targets.find((t) => t.label === result.label);
      const keyCount = target
        ? flattenLeafKeys(loadJsonCatalog(join(target.dir, 'en.json'))).length
        : 0;
      console.log(`check:i18n OK — ${result.label} (${keyCount} en keys)`);
    } else {
      failed = true;
    }
  }

  if (failed) {
    console.error(formatCoverageFailures(results));
    return 1;
  }

  return 0;
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.exit(main());
}
