// app/core/extensions/package-meta.test.js
import { describe, expect, it } from 'vitest';

import {
  LEGACY_PLUGIN_ID_MAP,
  LEGACY_THEME_ID_MAP,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
  normalizeLegacyIds,
  parseExtensionPackage,
  resolveBundledSlug,
  BUNDLED_PLUGIN_SLUGS,
  BUNDLED_THEME_SLUGS,
} from '#/core/extensions/package-meta';

const validPkg = {
  name: '@bermooda/sample-analytics',
  version: '1.0.0',
  description: 'Captures events',
  bermooda: {
    title: 'Sample Analytics',
    slug: 'sample-analytics',
    engine: '>=1.0.0',
  },
};

describe('parseExtensionPackage', () => {
  it('maps name/version/description/title/slug/engine', () => {
    expect(parseExtensionPackage(validPkg)).toEqual({
      id: '@bermooda/sample-analytics',
      version: '1.0.0',
      description: 'Captures events',
      title: 'Sample Analytics',
      slug: 'sample-analytics',
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
        bermooda: { title: 'Sample Analytics', slug: 'sample-analytics' },
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

  it('rewrites legacy email plugin package ids', () => {
    expect(
      normalizeLegacyIds(
        ['@bermooda/resend', 'sendgrid', '@bermooda/ses'],
        LEGACY_PLUGIN_ID_MAP
      )
    ).toEqual([
      '@bermooda/plugin-resend',
      '@bermooda/plugin-sendgrid',
      '@bermooda/plugin-ses',
    ]);
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

describe('resolveBundledSlug', () => {
  it('maps packaged id to slug', () => {
    expect(
      resolveBundledSlug('@bermooda/sample-analytics', BUNDLED_PLUGIN_SLUGS)
    ).toBe('sample-analytics');
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
