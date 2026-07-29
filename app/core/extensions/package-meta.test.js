// app/core/extensions/package-meta.test.js
import { describe, expect, it } from 'vitest';

import {
  assertSlugMatchesFolder,
  mergeExtensionPackage,
  parseExtensionPackage,
  resolveBundledSlug,
  BUNDLED_PLUGIN_SLUGS,
  BUNDLED_THEME_SLUGS,
} from '#/core/extensions/package-meta';

const validPkg = {
  name: '@acme/demo-plugin',
  version: '1.0.0',
  description: 'Captures events',
  bermooda: {
    title: 'Demo Plugin',
    slug: 'demo-plugin',
    engine: '>=1.0.0',
  },
};

describe('parseExtensionPackage', () => {
  it('maps name/version/description/title/slug/engine', () => {
    expect(parseExtensionPackage(validPkg)).toEqual({
      id: '@acme/demo-plugin',
      version: '1.0.0',
      description: 'Captures events',
      title: 'Demo Plugin',
      slug: 'demo-plugin',
      engine: '>=1.0.0',
    });
  });

  it('includes bermooda.settings when present', () => {
    const settings = [{ key: 'apiKey', label: 'API Key', type: 'text' }];
    expect(
      parseExtensionPackage({
        ...validPkg,
        bermooda: { ...validPkg.bermooda, settings },
      }).settings
    ).toEqual(settings);
  });

  it('throws when name/version/title/slug missing', () => {
    expect(() => parseExtensionPackage({ ...validPkg, name: '' })).toThrow(
      /name/
    );
    expect(() =>
      parseExtensionPackage({
        ...validPkg,
        bermooda: { title: 'X', slug: '' },
      })
    ).toThrow(/slug/);
  });

  it('throws when slug is not lowercase-hyphenated', () => {
    expect(() =>
      parseExtensionPackage({
        ...validPkg,
        bermooda: { title: 'X', slug: 'Sample_Analytics', engine: '>=1.0.0' },
      })
    ).toThrow(/slug/);
  });

  it('throws when bermooda.engine is missing', () => {
    expect(() =>
      parseExtensionPackage({
        ...validPkg,
        bermooda: { title: 'Demo Plugin', slug: 'demo-plugin' },
      })
    ).toThrow(/engine/);
  });
});

describe('mergeExtensionPackage', () => {
  it('lets package identity win over runtime fields', () => {
    const merged = mergeExtensionPackage(validPkg, {
      id: 'wrong',
      title: 'Wrong',
      hooks: { 'order.created': () => {} },
    });
    expect(merged.id).toBe('@acme/demo-plugin');
    expect(merged.title).toBe('Demo Plugin');
    expect(merged.hooks['order.created']).toBeTypeOf('function');
  });
});

describe('assertSlugMatchesFolder', () => {
  it('throws when folder !== slug', () => {
    expect(() =>
      assertSlugMatchesFolder('demo-plugin', 'other', 'plugin')
    ).toThrow(/demo-plugin/);
  });
});

describe('resolveBundledSlug', () => {
  it('maps packaged id to slug', () => {
    expect(
      resolveBundledSlug('@bermooda/meilisearch', BUNDLED_PLUGIN_SLUGS)
    ).toBe('meilisearch');
    expect(
      resolveBundledSlug('@bermooda/theme-default', BUNDLED_THEME_SLUGS)
    ).toBe('default');
  });

  it('passes through an already-valid slug', () => {
    expect(resolveBundledSlug('my-theme', BUNDLED_THEME_SLUGS)).toBe(
      'my-theme'
    );
  });

  it('returns null for unknown scoped package ids', () => {
    expect(resolveBundledSlug('@acme/other', BUNDLED_PLUGIN_SLUGS)).toBeNull();
  });
});
