import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { syncExtensionTwSources } from './sync-extension-tw-sources.mjs';

/** @type {string} */
let repoRoot;
/** @type {string} */
let cacheDir;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'bermooda-tw-sources-'));
  cacheDir = join(repoRoot, 'node_modules', '.cache', 'bermooda-tw-sources');
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

/**
 * @param {string} rel
 * @param {string} [contents]
 */
function writeRepoFile(rel, contents = '') {
  const path = join(repoRoot, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}

describe('syncExtensionTwSources', () => {
  it('links every theme and plugin folder into the Tailwind cache', () => {
    writeRepoFile('app/themes/default/package.json', '{}');
    writeRepoFile('app/themes/default/components/page.jsx', 'text-red-500');
    writeRepoFile('app/themes/README.md');
    mkdirSync(join(repoRoot, 'app/themes/.hidden'), { recursive: true });
    // No package.json: still linked, Tailwind only needs the files.
    writeRepoFile('app/plugins/draft/blocks/x.jsx');

    expect(syncExtensionTwSources({ repoRoot })).toEqual({
      themes: 1,
      plugins: 1,
    });

    const themeLink = join(cacheDir, 'themes', 'default');
    expect(lstatSync(themeLink).isSymbolicLink()).toBe(true);
    expect(realpathSync(themeLink)).toBe(
      realpathSync(join(repoRoot, 'app/themes/default'))
    );
    expect(readFileSync(join(themeLink, 'components/page.jsx'), 'utf8')).toBe(
      'text-red-500'
    );
    expect(readdirSync(join(cacheDir, 'themes'))).toEqual(['default']);
    expect(readdirSync(join(cacheDir, 'plugins'))).toEqual(['draft']);
  });

  it('drops links to removed extensions without touching link targets', () => {
    writeRepoFile('app/themes/default/index.js');
    mkdirSync(join(cacheDir, 'themes'), { recursive: true });
    const outside = join(repoRoot, 'outside');
    writeRepoFile('outside/keep.txt', 'keep');
    symlinkSync(outside, join(cacheDir, 'themes', 'removed'));

    syncExtensionTwSources({ repoRoot });
    syncExtensionTwSources({ repoRoot });

    expect(readdirSync(join(cacheDir, 'themes'))).toEqual(['default']);
    expect(readFileSync(join(outside, 'keep.txt'), 'utf8')).toBe('keep');
    expect(existsSync(join(repoRoot, 'app/themes/default/index.js'))).toBe(
      true
    );
  });

  it('creates empty link dirs when no extensions are installed', () => {
    const logs = [];
    expect(
      syncExtensionTwSources({ repoRoot, log: (msg) => logs.push(msg) })
    ).toEqual({ themes: 0, plugins: 0 });
    expect(readdirSync(join(cacheDir, 'themes'))).toEqual([]);
    expect(readdirSync(join(cacheDir, 'plugins'))).toEqual([]);
    expect(logs).toEqual([
      'extension-tw-sources: linked 0 theme(s), 0 plugin(s) → node_modules/.cache/bermooda-tw-sources',
    ]);
  });
});
