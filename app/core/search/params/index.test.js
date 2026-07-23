import { describe, expect, it } from 'vitest';

import {
  parsePublicSearchParams,
  resolveSearchSort,
} from '#/core/search/params';

describe('resolveSearchSort', () => {
  it('maps relevance to relevance', () => {
    expect(resolveSearchSort('relevance', 'desc')).toBe('relevance');
  });

  it('maps newest and createdAt to newest', () => {
    expect(resolveSearchSort('newest')).toBe('newest');
    expect(resolveSearchSort('createdAt')).toBe('newest');
  });

  it('maps price sort with direction', () => {
    expect(resolveSearchSort('price', 'asc')).toBe('price_asc');
    expect(resolveSearchSort('priceCents', 'desc')).toBe('price_desc');
  });
});

describe('parsePublicSearchParams', () => {
  it('maps API params to core search input', () => {
    const url = new URL(
      'http://localhost/api/v1/search?q=shirt&page=2&limit=10&locale=fr&currency=EUR&categoryId=cat_1&sortBy=price&sortDir=asc&priceMin=1000&priceMax=5000&inStock=1'
    );

    expect(parsePublicSearchParams(url)).toEqual({
      query: 'shirt',
      page: 2,
      limit: 10,
      locale: 'fr',
      currency: 'EUR',
      sort: 'price_asc',
      filters: {
        categoryId: 'cat_1',
        priceMin: 1000,
        priceMax: 5000,
        inStock: true,
      },
    });
  });

  it('applies defaults and caps limit', () => {
    const url = new URL('http://localhost/api/v1/search?limit=500');

    expect(parsePublicSearchParams(url)).toMatchObject({
      query: '',
      page: 1,
      limit: 100,
      locale: 'en',
      currency: 'USD',
      sort: 'relevance',
      filters: { categoryId: undefined },
    });
  });
});
