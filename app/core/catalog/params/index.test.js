import { describe, expect, it } from 'vitest';

import {
  parsePublicCatalogDetailParams,
  parsePublicCatalogListParams,
  parsePublicCategoryListParams,
} from '#/core/catalog/params';

describe('parsePublicCatalogListParams', () => {
  it('applies defaults and caps limit', () => {
    const url = new URL('http://localhost/api/v1/catalog');
    expect(parsePublicCatalogListParams(url)).toEqual({
      page: 1,
      limit: 20,
      locale: 'en',
      currency: 'USD',
      categoryId: undefined,
    });
  });

  it('parses pagination, locale, currency, and categoryId', () => {
    const url = new URL(
      'http://localhost/api/v1/catalog?page=2&limit=500&locale=de&currency=EUR&categoryId=cat_1'
    );
    expect(parsePublicCatalogListParams(url)).toEqual({
      page: 2,
      limit: 100,
      locale: 'de',
      currency: 'EUR',
      categoryId: 'cat_1',
    });
  });
});

describe('parsePublicCatalogDetailParams', () => {
  it('parses locale and currency', () => {
    const url = new URL(
      'http://localhost/api/v1/catalog/prod_1?locale=fr&currency=CAD'
    );
    expect(parsePublicCatalogDetailParams(url)).toEqual({
      locale: 'fr',
      currency: 'CAD',
    });
  });
});

describe('parsePublicCategoryListParams', () => {
  it('parses locale with default', () => {
    const url = new URL('http://localhost/api/v1/categories?locale=es');
    expect(parsePublicCategoryListParams(url)).toEqual({ locale: 'es' });
  });
});
