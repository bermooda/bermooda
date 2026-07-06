import { describe, expect, it } from 'vitest';

import {
  parseSeoSettingsInput,
  seoSettingsToKeyValues,
} from '#/core/seo/input';

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
      'seo.metaTitle': 'Shop',
      'seo.allowIndexing': false,
    });
  });
});
