import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildExtensionInstallArgs,
  collectExtensionRuntimeDependencyNames,
  filterExtensionsNeedingInstall,
  hasRuntimeDependencies,
  listExtensionPackages,
  runtimeDependencyNamesFromPackage,
} from '#/core/extensions/deps.server';

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

  it('ignores dependency fields that are not objects', () => {
    expect(
      runtimeDependencyNamesFromPackage(
        /** @type {any} */ ({
          dependencies: 'zod',
          optionalDependencies: ['meilisearch'],
        })
      )
    ).toEqual([]);
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

  it('throws with the path when a package.json is not valid JSON', () => {
    const dir = join(appDir, 'plugins', 'broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{ "name": ');

    expect(() => listExtensionPackages(appDir)).toThrow(
      /Invalid extension package.json at .*plugins\/broken\/package.json/
    );
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

describe('filterExtensionsNeedingInstall', () => {
  it('only includes packages with runtime dependencies', () => {
    writeExtension('themes', 'default', {
      peerDependencies: { react: '19' },
    });
    writeExtension('plugins', 'resend', {
      dependencies: { resend: '4.0.0' },
    });

    const needing = filterExtensionsNeedingInstall(
      listExtensionPackages(appDir)
    );
    expect(needing).toHaveLength(1);
    expect(needing[0].slug).toBe('resend');
  });
});

describe('buildExtensionInstallArgs', () => {
  it('uses npm install when the extension has no lockfile', () => {
    const dir = writeExtension('plugins', 'resend', {
      dependencies: { resend: '4.0.0' },
    });

    expect(buildExtensionInstallArgs({ dir })).toEqual([
      'install',
      '--prefix',
      dir,
      '--legacy-peer-deps',
    ]);
  });

  it('uses npm ci when the extension ships a lockfile', () => {
    const dir = writeExtension('themes', 'default', {
      dependencies: { 'theme-lib': '1.0.0' },
    });
    writeFileSync(join(dir, 'package-lock.json'), '{}');

    expect(buildExtensionInstallArgs({ dir }, { omitDev: true })).toEqual([
      'ci',
      '--prefix',
      dir,
      '--legacy-peer-deps',
      '--omit=dev',
    ]);
  });
});
