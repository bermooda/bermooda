import { describe, expect, it } from 'vitest';

import {
  normalizeTwitterHandle,
  parseSeoSettingsFormData,
  parseSeoSettingsInput,
  resolveEntityMediaUrl,
  seoSettingsToKeyValues,
  serializeJsonLd,
  serializeSeoSettings,
  truncateMetaDescription,
} from '#/core/seo/input';
import { SETTING_KEYS } from '#/core/settings/keys';

describe('parseSeoSettingsInput', () => {
  it('normalizes SEO fields', () => {
    expect(
      parseSeoSettingsInput({
        metaTitle: '  Shop  ',
        allowIndexing: 'on',
        twitterHandle: '@shop',
      })
    ).toEqual({
      metaTitle: 'Shop',
      allowIndexing: true,
      twitterHandle: 'shop',
    });
  });

  it('maps parsed values to setting keys', () => {
    expect(
      seoSettingsToKeyValues(
        parseSeoSettingsInput({
          metaTitle: 'Shop',
          allowIndexing: false,
        })
      )
    ).toEqual({
      [SETTING_KEYS.SEO_META_TITLE]: 'Shop',
      [SETTING_KEYS.SEO_ALLOW_INDEXING]: false,
    });
  });
});

describe('parseSeoSettingsFormData', () => {
  it('parses admin form submissions', () => {
    const formData = new FormData();
    formData.set('metaTitle', 'Shop');
    formData.set('allowIndexing', 'on');
    formData.set('twitterHandle', '@shop');

    expect(parseSeoSettingsFormData(formData)).toEqual({
      metaTitle: 'Shop',
      metaDescription: '',
      titleTemplate: '{pageTitle} | {shopName}',
      allowIndexing: true,
      googleSiteVerification: '',
      bingSiteVerification: '',
      twitterHandle: 'shop',
    });
  });
});

describe('serializeSeoSettings', () => {
  it('maps raw setting values to admin snapshot fields', () => {
    expect(
      serializeSeoSettings({
        [SETTING_KEYS.SEO_META_TITLE]: 'Shop',
        [SETTING_KEYS.SEO_ALLOW_INDEXING]: false,
      })
    ).toEqual({
      seoMetaTitle: 'Shop',
      seoMetaDescription: '',
      seoOgImageUrl: '',
      seoTitleTemplate: '{pageTitle} | {shopName}',
      seoAllowIndexing: false,
      seoGoogleSiteVerification: '',
      seoBingSiteVerification: '',
      seoTwitterHandle: '',
    });
  });
});

describe('normalizeTwitterHandle', () => {
  it('strips leading @ characters', () => {
    expect(normalizeTwitterHandle('@myshop')).toBe('myshop');
  });
});

describe('truncateMetaDescription', () => {
  it('limits description length', () => {
    expect(truncateMetaDescription('x'.repeat(200))).toHaveLength(160);
  });
});

describe('resolveEntityMediaUrl', () => {
  it('reads nested media URLs', () => {
    expect(
      resolveEntityMediaUrl({
        media: [{ media: { url: 'https://cdn.example/mug.jpg' } }],
      })
    ).toBe('https://cdn.example/mug.jpg');
  });
});

describe('serializeJsonLd', () => {
  it('escapes angle brackets', () => {
    expect(serializeJsonLd({ x: '<script>' })).not.toContain('<script>');
  });
});
