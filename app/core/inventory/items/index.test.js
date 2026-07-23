// app/core/inventory/items/index.test.js

import { describe, expect, it } from 'vitest';

import { inventoryItemsFromLines } from '#/core/inventory/items';

describe('inventoryItemsFromLines', () => {
  it('maps tracked lines to variant inventory payloads', () => {
    expect(
      inventoryItemsFromLines([
        { variantId: 'var_1', quantity: 2 },
        { variantId: null, quantity: 1 },
        { variantId: 'var_2', quantity: 3 },
      ])
    ).toEqual([
      { variantId: 'var_1', quantity: 2 },
      { variantId: 'var_2', quantity: 3 },
    ]);
  });

  it('returns an empty array for missing lines', () => {
    expect(inventoryItemsFromLines()).toEqual([]);
  });
});
