// app/core/wishlists/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    wishlist: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    wishlistItem: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    productVariant: { findUnique: vi.fn() },
  },
}));

vi.mock('#/core/catalog/translations.server', () => ({
  loadProductTitleMap: vi.fn(),
}));

vi.mock('#/core/customers/index.server', () => ({
  getCustomer: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { getCustomer } from '#/core/customers/index.server';
import {
  addToWishlist,
  buildWishlistItemWhere,
  deleteWishlistItem,
  getWishlistItem,
  getWishlistedVariantIds,
  listWishlistItems,
  listWishlistItemsAdmin,
  mapWishlistActionError,
  parseDeleteWishlistItemFromForm,
  parseWishlistAdminListParams,
  parseWishlistFromForm,
  parseWishlistListParams,
  parseWishlistMutationFromJson,
  parseWishlistMutationInput,
  removeFromWishlist,
  serializeWishlistItem,
} from '#/core/wishlists/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  loadProductTitleMap.mockResolvedValue(new Map());
});

describe('parseWishlistListParams', () => {
  it('parses pagination and filters', () => {
    const params = parseWishlistListParams(
      new URLSearchParams('page=2&limit=10&customerId=c1&variantId=v1&q=sku')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      customerId: 'c1',
      variantId: 'v1',
      q: 'sku',
    });
  });

  it('requires customerId', () => {
    expect(() => parseWishlistListParams({})).toThrow('customerId is required');
  });
});

describe('parseWishlistAdminListParams', () => {
  it('parses optional filters without requiring customerId', () => {
    expect(parseWishlistAdminListParams({ page: '1', q: 'shop' })).toEqual({
      page: 1,
      limit: 20,
      q: 'shop',
    });
  });
});

describe('buildWishlistItemWhere', () => {
  it('filters by customer and variant', () => {
    expect(
      buildWishlistItemWhere({ customerId: 'c1', variantId: 'v1' })
    ).toEqual({
      variantId: 'v1',
      wishlist: { customerId: 'c1' },
    });
  });

  it('searches by email or sku', () => {
    expect(buildWishlistItemWhere({ q: 'shop@example.com' })).toEqual({
      OR: [
        { variant: { sku: containsFilter('shop@example.com') } },
        {
          wishlist: {
            customer: { email: containsFilter('shop@example.com') },
          },
        },
      ],
    });
  });
});

describe('parseWishlistMutationInput', () => {
  it('normalizes mutation payload', () => {
    expect(
      parseWishlistMutationInput({
        customerId: ' c1 ',
        variantId: ' v1 ',
        intent: 'remove',
      })
    ).toEqual({
      customerId: 'c1',
      variantId: 'v1',
      intent: 'remove',
    });
  });

  it('requires customerId', () => {
    expect(() =>
      parseWishlistMutationInput({ variantId: 'v1', intent: 'add' })
    ).toThrow('customerId is required');
  });

  it('requires variantId', () => {
    expect(() =>
      parseWishlistMutationInput({ customerId: 'c1', intent: 'add' })
    ).toThrow('variantId is required');
  });
});

describe('parseWishlistFromForm', () => {
  it('reads storefront add intent', () => {
    const formData = new FormData();
    formData.set('intent', 'wishlist-add');
    formData.set('variantId', 'v1');

    expect(parseWishlistFromForm(formData, { customerId: 'c1' })).toEqual({
      customerId: 'c1',
      variantId: 'v1',
      intent: 'add',
    });
  });

  it('reads account remove intent', () => {
    const formData = new FormData();
    formData.set('intent', 'remove');
    formData.set('variantId', 'v1');

    expect(parseWishlistFromForm(formData, { customerId: 'c1' })).toEqual({
      customerId: 'c1',
      variantId: 'v1',
      intent: 'remove',
    });
  });
});

describe('parseWishlistMutationFromJson', () => {
  it('parses admin JSON body', () => {
    expect(
      parseWishlistMutationFromJson({
        customerId: 'c1',
        variantId: 'v1',
        intent: 'remove',
      })
    ).toEqual({
      customerId: 'c1',
      variantId: 'v1',
      intent: 'remove',
    });
  });
});

describe('mapWishlistActionError', () => {
  it('maps product-page wishlist errors', () => {
    expect(
      mapWishlistActionError(
        Object.assign(new Error('variant required'), {
          code: 'VARIANT_ID_REQUIRED',
        })
      )
    ).toEqual({ wishlistError: 'Select a variant first.' });
  });

  it('maps account wishlist errors', () => {
    expect(
      mapWishlistActionError(
        Object.assign(new Error('unknown'), {
          code: 'INVALID_WISHLIST_ACTION',
        }),
        { style: 'account' }
      )
    ).toEqual({ ok: false, error: 'Unknown action.' });
  });
});

describe('parseDeleteWishlistItemFromForm', () => {
  it('parses delete intent', () => {
    const formData = new FormData();
    formData.set('intent', 'delete');
    formData.set('id', 'wi-1');

    expect(parseDeleteWishlistItemFromForm(formData)).toEqual({ id: 'wi-1' });
  });
});

describe('serializeWishlistItem', () => {
  it('serializes item with ISO dates and customer', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(
      serializeWishlistItem(
        {
          id: 'wi-1',
          wishlistId: 'w1',
          variantId: 'v1',
          createdAt,
          variant: { sku: 'SKU-1', productId: 'p1' },
          wishlist: {
            customerId: 'c1',
            customer: { id: 'c1', name: 'Buyer', email: 'buyer@example.com' },
          },
        },
        { productTitle: 'Tee' }
      )
    ).toEqual({
      id: 'wi-1',
      wishlistId: 'w1',
      variantId: 'v1',
      createdAt: '2026-01-01T00:00:00.000Z',
      variantSku: 'SKU-1',
      productId: 'p1',
      productTitle: 'Tee',
      customerId: 'c1',
      customer: { id: 'c1', name: 'Buyer', email: 'buyer@example.com' },
    });
  });
});

describe('addToWishlist', () => {
  it('upserts item after variant validation', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'v1' });
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.upsert.mockResolvedValue({ id: 'wi1' });

    await addToWishlist('c1', 'v1');
    expect(prisma.wishlistItem.upsert).toHaveBeenCalled();
  });

  it('throws when variant is missing', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);

    await expect(addToWishlist('c1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('validates customer when requested', async () => {
    getCustomer.mockResolvedValue(null);

    await expect(
      addToWishlist('missing', 'v1', { validateCustomer: true })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('removeFromWishlist', () => {
  it('deletes item when present', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

    await removeFromWishlist('c1', 'v1');
    expect(prisma.wishlistItem.deleteMany).toHaveBeenCalled();
  });

  it('throws when wishlist is missing', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(null);

    await expect(removeFromWishlist('c1', 'v1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws when item is missing', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.deleteMany.mockResolvedValue({ count: 0 });

    await expect(removeFromWishlist('c1', 'v1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('getWishlistedVariantIds', () => {
  it('returns empty array without creating a wishlist', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(null);

    await expect(getWishlistedVariantIds('c1', 'p1')).resolves.toEqual([]);
    expect(prisma.wishlist.create).not.toHaveBeenCalled();
  });

  it('returns variant ids for an existing wishlist', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.findMany.mockResolvedValue([
      { variantId: 'v1' },
      { variantId: 'v2' },
    ]);

    await expect(getWishlistedVariantIds('c1', 'p1')).resolves.toEqual([
      'v1',
      'v2',
    ]);
  });
});

describe('listWishlistItems', () => {
  it('returns paginated serialized items', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      {
        id: 'wi-1',
        wishlistId: 'w1',
        variantId: 'v1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        variant: { sku: 'SKU-1', productId: 'p1' },
        wishlist: {
          customerId: 'c1',
          customer: { id: 'c1', name: null, email: 'buyer@example.com' },
        },
      },
    ]);
    prisma.wishlistItem.count.mockResolvedValue(1);

    const result = await listWishlistItems({
      customerId: 'c1',
      page: 1,
      limit: 20,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].variantSku).toBe('SKU-1');
  });
});

describe('listWishlistItemsAdmin', () => {
  it('lists items across customers', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([]);
    prisma.wishlistItem.count.mockResolvedValue(0);

    const result = await listWishlistItemsAdmin({
      page: 1,
      limit: 20,
      q: 'sku',
    });
    expect(result.total).toBe(0);
    expect(prisma.wishlistItem.findMany).toHaveBeenCalled();
  });
});

describe('getWishlistItem', () => {
  it('returns serialized item', async () => {
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'wi-1',
      wishlistId: 'w1',
      variantId: 'v1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      variant: { sku: 'SKU-1', productId: 'p1' },
      wishlist: {
        customerId: 'c1',
        customer: { id: 'c1', name: null, email: 'buyer@example.com' },
      },
    });

    const item = await getWishlistItem('wi-1');
    expect(item.id).toBe('wi-1');
  });

  it('throws when item is missing', async () => {
    prisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(getWishlistItem('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteWishlistItem', () => {
  it('deletes existing item', async () => {
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'wi-1' });
    prisma.wishlistItem.delete.mockResolvedValue({ id: 'wi-1' });

    await expect(deleteWishlistItem('wi-1')).resolves.toEqual({
      deleted: true,
    });
  });
});
