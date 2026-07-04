// app/core/search/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted so factories can reference them.
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    translation: { findMany: vi.fn() },
    productVariant: { findMany: vi.fn() },
    variantPrice: { findMany: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    slug: { findFirst: vi.fn() },
    channelPriceOverride: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('#/libs/prisma.server', () => ({ default: mockPrisma }));
vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import module under test after mocks are registered.
// ---------------------------------------------------------------------------

import {
  __resetRegistry,
  _registry,
  dbProvider,
  getProvider,
  listProviders,
  registerProvider,
  search,
  searchWith,
  setDefaultProvider,
} from '#/core/search/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(name = 'test') {
  return { name, search: vi.fn() };
}

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe('search registry', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
  });

  it('registerProvider + getProvider returns the same object', () => {
    const p = makeProvider();
    registerProvider('foo', p);
    expect(getProvider('foo')).toBe(p);
  });

  it('registerProvider throws for empty id', () => {
    expect(() => registerProvider('', makeProvider())).toThrow(
      'Provider id must be a non-empty string'
    );
  });

  it('registerProvider throws for non-object provider', () => {
    expect(() => registerProvider('foo', null)).toThrow(
      'Provider must be an object'
    );
  });

  it('getProvider throws for unknown id', () => {
    expect(() => getProvider('nonexistent')).toThrow(
      'Search provider "nonexistent" is not registered'
    );
  });

  it('listProviders returns all registered ids', () => {
    registerProvider('a', makeProvider());
    registerProvider('b', makeProvider());
    expect(listProviders()).toEqual(expect.arrayContaining(['a', 'b']));
    expect(listProviders()).toHaveLength(2);
  });

  it('first registered provider becomes default', () => {
    const p = makeProvider();
    p.search.mockResolvedValue({ products: [], total: 0, facets: {} });
    registerProvider('first', p);
    registerProvider('second', makeProvider());
    search({});
    expect(p.search).toHaveBeenCalledOnce();
  });

  it('setDefaultProvider switches the default', () => {
    const p1 = makeProvider('p1');
    const p2 = makeProvider('p2');
    p2.search.mockResolvedValue({ products: [], total: 0, facets: {} });
    registerProvider('p1', p1);
    registerProvider('p2', p2);
    setDefaultProvider('p2');
    search({});
    expect(p2.search).toHaveBeenCalledOnce();
    expect(p1.search).not.toHaveBeenCalled();
  });

  it('setDefaultProvider throws for unknown id', () => {
    expect(() => setDefaultProvider('ghost')).toThrow(
      'Search provider "ghost" is not registered'
    );
  });

  it('search throws when no provider is registered', () => {
    expect(() => search({})).toThrow('No search provider registered');
  });

  it('search delegates params to the default provider', () => {
    const p = makeProvider();
    p.search.mockResolvedValue({ products: [], total: 0, facets: {} });
    registerProvider('myp', p);
    const params = { query: 'shirt', page: 2 };
    search(params);
    expect(p.search).toHaveBeenCalledWith(params);
  });

  it('searchWith delegates to the named provider', () => {
    const p1 = makeProvider('p1');
    const p2 = makeProvider('p2');
    p2.search.mockResolvedValue({ products: [], total: 0, facets: {} });
    registerProvider('p1', p1);
    registerProvider('p2', p2);
    searchWith('p2', { query: 'test' });
    expect(p2.search).toHaveBeenCalledWith({ query: 'test' });
    expect(p1.search).not.toHaveBeenCalled();
  });

  it('__resetRegistry clears all providers and resets default', () => {
    registerProvider('a', makeProvider());
    __resetRegistry();
    expect(listProviders()).toHaveLength(0);
    expect(() => search({})).toThrow('No search provider registered');
  });

  it('_registry is exported for direct inspection', () => {
    registerProvider('z', makeProvider());
    expect(_registry.has('z')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dbProvider tests
// ---------------------------------------------------------------------------

describe('dbProvider.search', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default stub responses so every call has safe fallbacks.
    mockPrisma.translation.findMany.mockResolvedValue([]);
    mockPrisma.productVariant.findMany.mockResolvedValue([]);
    mockPrisma.variantPrice.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.slug.findFirst.mockResolvedValue(null);
  });

  it('returns empty results when no products match', async () => {
    const result = await dbProvider.search({ query: 'xyz' });
    expect(result).toMatchObject({ products: [], total: 0 });
    expect(result.facets).toBeDefined();
  });

  it('passes no id filter when query is empty (all products)', async () => {
    await dbProvider.search({ query: '' });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.id).toBeUndefined();
  });

  it('filters by text match ids when query is non-empty', async () => {
    mockPrisma.translation.findMany.mockResolvedValue([
      { entityId: 'p1' },
      { entityId: 'p2' },
    ]);

    await dbProvider.search({ query: 'shirt', locale: 'en' });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.id).toMatchObject({
      in: expect.arrayContaining(['p1', 'p2']),
    });
  });

  it('filters by sku matches when query matches sku', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([{ productId: 'p3' }]);

    await dbProvider.search({ query: 'SKU123' });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.id).toMatchObject({
      in: expect.arrayContaining(['p3']),
    });
  });

  it('intersects text ids and price ids', async () => {
    // text match: p1, p2; price match: p2, p3 → intersection: p2
    mockPrisma.translation.findMany.mockResolvedValue([
      { entityId: 'p1' },
      { entityId: 'p2' },
    ]);
    mockPrisma.variantPrice.findMany.mockResolvedValue([
      { variant: { productId: 'p2' } },
      { variant: { productId: 'p3' } },
    ]);

    await dbProvider.search({
      query: 'shirt',
      filters: { priceMin: 1000, priceMax: 5000 },
    });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.id).toMatchObject({ in: ['p2'] });
  });

  it('applies categoryId filter', async () => {
    await dbProvider.search({
      query: '',
      filters: { categoryId: 'cat_1' },
    });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.categories).toMatchObject({
      some: { categoryId: 'cat_1' },
    });
  });

  it('applies channelId publish filter via AND condition', async () => {
    await dbProvider.search({
      query: '',
      filters: { channelId: 'ch_1' },
    });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              channelProducts: { some: { channelId: 'ch_1', published: true } },
            }),
          ]),
        }),
      ])
    );
  });

  it('applies inStock filter via AND condition', async () => {
    await dbProvider.search({
      query: '',
      filters: { inStock: true },
    });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variants: expect.any(Object) }),
      ])
    );
  });

  it('applies attribute filter via AND conditions', async () => {
    await dbProvider.search({
      query: '',
      filters: { attributes: { Color: ['Red', 'Blue'] } },
    });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    const and = productFindCall.where.AND;
    expect(and).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributes: expect.any(Object) }),
      ])
    );
  });

  it('paginates correctly (skip/take)', async () => {
    await dbProvider.search({ query: '', page: 3, limit: 10 });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.skip).toBe(20);
    expect(productFindCall.take).toBe(10);
  });

  it('uses newest orderBy when sort is newest', async () => {
    await dbProvider.search({ sort: 'newest' });

    const productFindCall = mockPrisma.product.findMany.mock.calls[0][0];
    expect(productFindCall.orderBy).toEqual([{ createdAt: 'desc' }]);
  });

  it('hydrates products with translations when locale provided', async () => {
    const pageProduct = {
      id: 'p1',
      publishedAt: new Date(),
      variants: [],
      media: [],
    };
    const facetProduct = {
      id: 'p1',
      categories: [],
      variants: [],
      attributes: [],
    };

    // First call: paginated results; second call: facet data.
    mockPrisma.product.findMany
      .mockResolvedValueOnce([pageProduct])
      .mockResolvedValueOnce([facetProduct]);
    mockPrisma.product.count.mockResolvedValue(1);

    mockPrisma.translation.findMany.mockImplementation(({ where }) => {
      if (where.entityId === 'p1' && where.entityType === 'product') {
        return Promise.resolve([{ field: 'title', value: 'Test Shirt' }]);
      }
      return Promise.resolve([]);
    });
    mockPrisma.slug.findFirst.mockResolvedValue({ slug: 'test-shirt' });

    const { products } = await dbProvider.search({ query: '', locale: 'en' });

    expect(products[0].title).toBe('Test Shirt');
    expect(products[0].slug).toBe('test-shirt');
  });

  it('builds facets with availability count', async () => {
    const productWithStock = {
      id: 'p1',
      categories: [],
      variants: [{ inventoryTracked: true, inventoryCount: 5, prices: [] }],
      attributes: [],
    };
    const productOutOfStock = {
      id: 'p2',
      categories: [],
      variants: [{ inventoryTracked: true, inventoryCount: 0, prices: [] }],
      attributes: [],
    };

    // findMany is called twice: once for pagination, once for facets.
    mockPrisma.product.findMany
      .mockResolvedValueOnce([]) // page results
      .mockResolvedValueOnce([productWithStock, productOutOfStock]); // facets
    mockPrisma.product.count.mockResolvedValue(0);

    const { facets } = await dbProvider.search({ query: '' });

    expect(facets.availability.inStock).toBe(1);
    expect(facets.availability.total).toBe(2);
  });

  it('builds attribute facets from product attributes', async () => {
    const productWithAttr = {
      id: 'p1',
      categories: [],
      variants: [{ inventoryTracked: false, inventoryCount: 0, prices: [] }],
      attributes: [
        { name: 'Color', values: [{ value: 'Red' }, { value: 'Blue' }] },
      ],
    };

    mockPrisma.product.findMany
      .mockResolvedValueOnce([]) // page results
      .mockResolvedValueOnce([productWithAttr]); // facets
    mockPrisma.product.count.mockResolvedValue(0);

    const { facets } = await dbProvider.search({ query: '' });

    expect(facets.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Color',
          values: expect.arrayContaining([
            expect.objectContaining({ value: 'Red', count: 1 }),
            expect.objectContaining({ value: 'Blue', count: 1 }),
          ]),
        }),
      ])
    );
  });
});
