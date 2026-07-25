// app/core/extensions/package-meta.test.js
import { describe, expect, it } from 'vitest';
import {
  LEGACY_PLUGIN_ID_MAP,
  LEGACY_THEME_ID_MAP,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
  normalizeLegacyIds,
  parseExtensionPackage,
} from '#/core/extensions/package-meta';

const validPkg = {
  name: '@bermooda/sample-analytics',
  version: '1.0.0',
  description: 'Captures events',
  bermooda: {
    title: 'Sample Analytics',
    slug: 'sample-analytics',
  },
};

describe('parseExtensionPackage', () => {
  it('maps name/version/description/title/slug', () => {
    expect(parseExtensionPackage(validPkg)).toEqual({
      id: '@bermooda/sample-analytics',
      version: '1.0.0',
      description: 'Captures events',
      title: 'Sample Analytics',
      slug: 'sample-analytics',
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
        bermooda: { title: 'X', slug: 'Sample_Analytics' },
      })
    ).toThrow(/slug/);
  });
});

describe('mergeExtensionPackage', () => {
  it('lets package identity win over runtime fields', () => {
    const merged = mergeExtensionPackage(validPkg, {
      id: 'wrong',
      title: 'Wrong',
      hooks: { 'order.created': () => {} },
    });
    expect(merged.id).toBe('@bermooda/sample-analytics');
    expect(merged.title).toBe('Sample Analytics');
    expect(merged.hooks['order.created']).toBeTypeOf('function');
  });
});

describe('normalizeLegacyIds', () => {
  it('rewrites known short plugin ids', () => {
    expect(
      normalizeLegacyIds(
        ['sample-analytics', '@acme/other'],
        LEGACY_PLUGIN_ID_MAP
      )
    ).toEqual(['@bermooda/sample-analytics', '@acme/other']);
  });

  it('rewrites legacy default theme id', () => {
    expect(normalizeLegacyIds(['default'], LEGACY_THEME_ID_MAP)).toEqual([
      '@bermooda/theme-default',
    ]);
  });
});

describe('assertSlugMatchesFolder', () => {
  it('throws when folder !== slug', () => {
    expect(() =>
      assertSlugMatchesFolder('sample-analytics', 'other', 'plugin')
    ).toThrow(/sample-analytics/);
  });
});
