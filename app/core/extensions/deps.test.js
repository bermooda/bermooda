import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  collectExtensionRuntimeDependencyNames,
  hasRuntimeDependencies,
  listExtensionPackages,
  listExtensionsNeedingInstall,
  runtimeDependencyNamesFromPackage,
} from './deps.js';

/** @type {string} */
let appDir;

beforeEach(() => {
  appDir = join(
    tmpdir(),
    `bermooda-ext-deps-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  mkdirSync(join(appDir, 'themes'), { recursive: true });
  mkdirSync(join(appDir, 'plugins'), { recursive: true });
});

afterEach(() => {
  rmSync(appDir, { recursive: true, force: true });
});

/**
 * @param {string} kind
 * @param {string} slug
 * @param {object} pkg
 */
function writeExtension(kind, slug, pkg) {
  const dir = join(appDir, kind, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  return dir;
}

describe('runtimeDependencyNamesFromPackage', () => {
  it('merges dependencies and optionalDependencies, sorted', () => {
    expect(
      runtimeDependencyNamesFromPackage({
        dependencies: { zod: '1', meilisearch: '2' },
        optionalDependencies: { 'optional-pkg': '1' },
        peerDependencies: { react: '19' },
        devDependencies: { vitest: '4' },
      })
    ).toEqual(['meilisearch', 'optional-pkg', 'zod']);
  });

  it('returns empty for nullish or empty packages', () => {
    expect(runtimeDependencyNamesFromPackage(null)).toEqual([]);
    expect(runtimeDependencyNamesFromPackage({})).toEqual([]);
    expect(hasRuntimeDependencies({ peerDependencies: { react: '19' } })).toBe(
      false
    );
  });
});

describe('listExtensionPackages', () => {
  it('discovers theme and plugin packages and skips incomplete folders', () => {
    writeExtension('themes', 'default', {
      name: '@bermooda/theme-default',
      dependencies: { 'theme-lib': '1.0.0' },
    });
    writeExtension('plugins', 'meilisearch', {
      name: '@bermooda/plugin-meilisearch',
      dependencies: { meilisearch: '0.40.0' },
    });
    mkdirSync(join(appDir, 'plugins', 'empty'), { recursive: true });
    writeFileSync(join(appDir, 'themes', 'README.md'), 'skip me');

    const pkgs = listExtensionPackages(appDir);
    expect(pkgs.map((p) => `${p.kind}/${p.slug}`).sort()).toEqual([
      'plugins/meilisearch',
      'themes/default',
    ]);
  });
});

describe('collectExtensionRuntimeDependencyNames', () => {
  it('unions runtime deps across extensions without peers or duplicates', () => {
    writeExtension('themes', 'default', {
      dependencies: { 'shared-lib': '1', 'theme-only': '1' },
      peerDependencies: { react: '19' },
    });
    writeExtension('plugins', 'meilisearch', {
      dependencies: { 'meilisearch': '0.40.0', 'shared-lib': '2' },
      optionalDependencies: { 'opt-sdk': '1' },
      devDependencies: { vitest: '4' },
    });

    expect(collectExtensionRuntimeDependencyNames(appDir)).toEqual([
      'meilisearch',
      'opt-sdk',
      'shared-lib',
      'theme-only',
    ]);
  });

  it('returns empty when no extensions are installed', () => {
    expect(collectExtensionRuntimeDependencyNames(appDir)).toEqual([]);
  });
});

describe('listExtensionsNeedingInstall', () => {
  it('only includes packages with runtime dependencies', () => {
    writeExtension('themes', 'default', {
      peerDependencies: { react: '19' },
    });
    writeExtension('plugins', 'resend', {
      dependencies: { resend: '4.0.0' },
    });

    const needing = listExtensionsNeedingInstall(appDir);
    expect(needing).toHaveLength(1);
    expect(needing[0].slug).toBe('resend');
  });
});
