import { describe, expect, it } from 'vitest';

import {
  parseCollectionRules,
  productMatchesCollectionRules,
} from '#/core/collections/rules.server';

const baseProduct = {
  tags: [{ tag: { name: 'sale' } }, { tag: { name: 'featured' } }],
  categories: [{ categoryId: 'cat-1' }],
  variants: [
    {
      inventoryTracked: true,
      inventoryCount: 5,
      prices: [{ currency: 'USD', priceCents: 2500 }],
    },
  ],
};

describe('parseCollectionRules', () => {
  it('returns defaults for invalid JSON', () => {
    expect(parseCollectionRules('not-json')).toEqual({
      match: 'all',
      conditions: [],
    });
  });

  it('normalizes match mode and conditions', () => {
    expect(
      parseCollectionRules({
        match: 'any',
        conditions: [{ type: 'tag', value: 'sale' }],
      })
    ).toEqual({
      match: 'any',
      conditions: [{ type: 'tag', value: 'sale' }],
    });
  });
});

describe('productMatchesCollectionRules', () => {
  it('matches tag rules', () => {
    const rules = {
      match: 'all',
      conditions: [{ type: 'tag', value: 'sale' }],
    };
    expect(productMatchesCollectionRules(baseProduct, rules)).toBe(true);
    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'all',
        conditions: [{ type: 'tag', value: 'clearance' }],
      })
    ).toBe(false);
  });

  it('matches category rules', () => {
    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'all',
        conditions: [{ type: 'category', value: 'cat-1' }],
      })
    ).toBe(true);
  });

  it('matches price rules using the lowest variant price', () => {
    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'all',
        conditions: [
          { type: 'price_min', value: 2000 },
          { type: 'price_max', value: 3000 },
        ],
      })
    ).toBe(true);

    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'all',
        conditions: [{ type: 'price_max', value: 1000 }],
      })
    ).toBe(false);
  });

  it('matches in-stock rules', () => {
    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'all',
        conditions: [{ type: 'in_stock', value: true }],
      })
    ).toBe(true);

    const outOfStock = {
      ...baseProduct,
      variants: [{ inventoryTracked: true, inventoryCount: 0, prices: [] }],
    };
    expect(
      productMatchesCollectionRules(outOfStock, {
        match: 'all',
        conditions: [{ type: 'in_stock', value: true }],
      })
    ).toBe(false);
  });

  it('supports any-match mode', () => {
    expect(
      productMatchesCollectionRules(baseProduct, {
        match: 'any',
        conditions: [
          { type: 'tag', value: 'missing' },
          { type: 'tag', value: 'sale' },
        ],
      })
    ).toBe(true);
  });
});
