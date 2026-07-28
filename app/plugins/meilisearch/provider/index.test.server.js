import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSearch } = vi.hoisted(() => ({
  mockDbSearch: vi.fn(),
}));

vi.mock('#/core/search/index.server', () => ({
  dbProvider: {
    search: mockDbSearch,
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { meilisearchProvider } from './index.server';

describe('meilisearch provider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockDbSearch.mockResolvedValue({
      products: [{ id: 'db-product' }],
      total: 1,
      facets: {
        categories: [],
        price: { min: 0, max: 0 },
        attributes: [],
        availability: { inStock: 1, total: 1 },
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('falls back to the database provider when Meilisearch is not configured', async () => {
    delete process.env.MEILISEARCH_HOST;
    delete process.env.MEILISEARCH_API_KEY;

    const params = { query: 'shirt', page: 1, limit: 12 };
    const result = await meilisearchProvider.search(params);

    expect(mockDbSearch).toHaveBeenCalledWith(params);
    expect(result.products[0].id).toBe('db-product');
  });

  it('maps Meilisearch hits into the shared search response shape', async () => {
    process.env.MEILISEARCH_HOST = 'https://search.example.com';
    process.env.MEILISEARCH_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          hits: [
            {
              id: 'product_1',
              slug: 'linen-shirt',
              title: 'Linen Shirt',
              variants: [{ id: 'variant_1' }],
              media: [{ url: '/shirt.jpg' }],
            },
          ],
          totalHits: 1,
          facetDistribution: { inStock: { true: 1 } },
        }),
      })
    );

    const result = await meilisearchProvider.search({
      query: 'shirt',
      filters: {
        categoryId: 'cat_1',
        inStock: true,
        priceMin: 1000,
        priceMax: 5000,
      },
      sort: 'price_asc',
      page: 2,
      limit: 12,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://search.example.com/indexes/products/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
        body: JSON.stringify({
          q: 'shirt',
          filter:
            'categoryIds = "cat_1" AND inStock = true AND priceCents >= 1000 AND priceCents <= 5000',
          sort: ['priceCents:asc'],
          hitsPerPage: 12,
          page: 2,
          facets: ['categoryIds', 'inStock'],
        }),
      })
    );
    expect(result).toEqual({
      products: [
        {
          id: 'product_1',
          slug: 'linen-shirt',
          title: 'Linen Shirt',
          variants: [{ id: 'variant_1' }],
          media: [{ url: '/shirt.jpg' }],
        },
      ],
      total: 1,
      facets: {
        categories: [],
        price: { min: 0, max: 0 },
        attributes: [],
        availability: { inStock: 1, total: 1 },
      },
    });
  });

  it('falls back to the database provider when the Meilisearch request fails', async () => {
    process.env.MEILISEARCH_HOST = 'https://search.example.com';
    process.env.MEILISEARCH_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'upstream failure',
      })
    );

    const params = { query: 'jacket' };
    const result = await meilisearchProvider.search(params);

    expect(mockDbSearch).toHaveBeenCalledWith(params);
    expect(result.products[0].id).toBe('db-product');
  });
});
