import { describe, expect, it } from 'vitest';

import {
  findVariantBySelectedOptions,
  isVariantInStock,
  pickVariantPriceForCurrency,
  resolveProductDisplayPrice,
  resolveProductHref,
  resolveProductSlug,
} from '#/core/catalog/display';
import { parseShippingAddressSnapshot } from '#/core/orders/address-snapshot';

describe('catalog display helpers', () => {
  it('resolveProductSlug handles nested slug objects', () => {
    expect(resolveProductSlug({ slug: { slug: 'blue-shirt' }, id: 'p1' })).toBe(
      'blue-shirt'
    );
    expect(resolveProductSlug({ slug: 'hat', id: 'p2' })).toBe('hat');
    expect(resolveProductSlug({ id: 'p3' })).toBe('p3');
  });

  it('resolveProductDisplayPrice prefers displayPrice', () => {
    expect(
      resolveProductDisplayPrice({
        displayPrice: 1200,
        variantPrices: [{ priceCents: 900 }],
      })
    ).toBe(1200);
  });

  it('resolveProductHref builds storefront path', () => {
    expect(resolveProductHref({ slug: 'mug', id: 'p1' })).toBe('/products/mug');
  });

  it('pickVariantPriceForCurrency matches currency', () => {
    const variant = {
      prices: [
        { currency: 'EUR', priceCents: 1000 },
        { currency: 'USD', priceCents: 1100 },
      ],
    };
    expect(pickVariantPriceForCurrency(variant, 'USD').priceCents).toBe(1100);
  });

  it('isVariantInStock uses inventoryCount', () => {
    expect(
      isVariantInStock({ inventoryTracked: true, inventoryCount: 2 })
    ).toBe(true);
    expect(
      isVariantInStock({ inventoryTracked: true, inventoryCount: 0 })
    ).toBe(false);
    expect(
      isVariantInStock({ inventoryTracked: false, inventoryCount: 0 })
    ).toBe(true);
  });

  it('findVariantBySelectedOptions matches option values', () => {
    const variants = [
      {
        id: 'v1',
        options: [
          { name: 'Size', value: 'M' },
          { name: 'Color', value: 'Blue' },
        ],
      },
      {
        id: 'v2',
        options: [
          { name: 'Size', value: 'L' },
          { name: 'Color', value: 'Blue' },
        ],
      },
    ];

    expect(
      findVariantBySelectedOptions(variants, { Size: 'L', Color: 'Blue' })?.id
    ).toBe('v2');
  });
});

describe('parseShippingAddressSnapshot', () => {
  it('parses JSON string snapshots', () => {
    expect(
      parseShippingAddressSnapshot({
        shippingAddressSnapshot: '{"city":"Paris","country":"FR"}',
      })
    ).toEqual({ city: 'Paris', country: 'FR' });
  });

  it('returns object snapshots as-is', () => {
    expect(
      parseShippingAddressSnapshot({
        shippingAddressSnapshot: { city: 'Berlin' },
      })
    ).toEqual({ city: 'Berlin' });
  });
});
