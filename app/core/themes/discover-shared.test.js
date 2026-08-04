import { describe, expect, it } from 'vitest';

import {
  buildMergedThemeManifest,
  indexThemeManifest,
} from '#/core/themes/discover-shared';

const validPkg = {
  name: '@bermooda/theme-aurora',
  version: '1.2.0',
  description: 'Aurora storefront',
  bermooda: {
    title: 'Aurora',
    slug: 'aurora',
    engine: '>=1.0.0',
    settings: [{ key: 'accent', label: 'Accent', type: 'text' }],
  },
};

describe('buildMergedThemeManifest', () => {
  it('merges package identity over runtime fields', () => {
    const Layout = () => null;
    const merged = buildMergedThemeManifest(validPkg, {
      id: 'wrong',
      title: 'Wrong',
      components: { Layout },
    });

    expect(merged.id).toBe('@bermooda/theme-aurora');
    expect(merged.title).toBe('Aurora');
    expect(merged.slug).toBe('aurora');
    expect(merged.version).toBe('1.2.0');
    expect(merged.engine).toBe('>=1.0.0');
    expect(merged.settings).toEqual(validPkg.bermooda.settings);
    expect(merged.components.Layout).toBe(Layout);
  });

  it('throws when package.json identity is malformed', () => {
    expect(() =>
      buildMergedThemeManifest(
        { name: '', version: '1.0.0', bermooda: { title: 'X', slug: 'x' } },
        {}
      )
    ).toThrow(/name/);
  });
});

describe('indexThemeManifest', () => {
  it('indexes the manifest by id and slug', () => {
    /** @type {Record<string, object>} */
    const registry = {};
    const manifest = {
      id: '@bermooda/theme-aurora',
      slug: 'aurora',
      title: 'Aurora',
    };

    indexThemeManifest(registry, manifest);

    expect(registry['@bermooda/theme-aurora']).toBe(manifest);
    expect(registry.aurora).toBe(manifest);
  });

  it('indexes by id only when slug is absent', () => {
    /** @type {Record<string, object>} */
    const registry = {};
    const manifest = { id: '@bermooda/theme-plain', title: 'Plain' };

    indexThemeManifest(registry, manifest);

    expect(registry['@bermooda/theme-plain']).toBe(manifest);
    expect(Object.keys(registry)).toEqual(['@bermooda/theme-plain']);
  });
});
