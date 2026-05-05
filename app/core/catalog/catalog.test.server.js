// app/core/catalog/catalog.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    $transaction: vi.fn(async (ops) => {
      // Support both array-of-promises and callback forms.
      if (typeof ops === 'function') return ops(mockTx);
      return Promise.all(ops);
    }),
    translation: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    slug: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productVariant: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    variantPrice: {
      upsert: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productMedia: {
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';

// Build a transaction mock that delegates to the same mock fns.
const mockTx = {
  slug: {
    updateMany: (...args) => prisma.slug.updateMany(...args),
    upsert: (...args) => prisma.slug.upsert(...args),
  },
};

import {
  resolveSlug,
  setSlug,
  setTranslation,
  getTranslations,
  listProducts,
  createProduct,
  publishProduct,
  unpublishProduct,
  attachMedia,
  reorderMedia,
  detachMedia,
  createVariant,
} from '#/core/catalog/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// resolveSlug
// ---------------------------------------------------------------------------

describe('resolveSlug', () => {
  it('returns null when slug does not exist', async () => {
    prisma.slug.findUnique.mockResolvedValue(null);

    const result = await resolveSlug('no-such-slug');

    expect(result).toBeNull();
    expect(prisma.slug.findUnique).toHaveBeenCalledWith({ where: { slug: 'no-such-slug' } });
  });

  it('returns entityType, entityId, locale when slug exists', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'product',
      entityId: 'prod_1',
      locale: 'en',
      slug: 'cool-shirt',
      canonical: true,
    });

    const result = await resolveSlug('cool-shirt');

    expect(result).toEqual({ entityType: 'product', entityId: 'prod_1', locale: 'en' });
  });
});

// ---------------------------------------------------------------------------
// setSlug
// ---------------------------------------------------------------------------

describe('setSlug', () => {
  it('marks old canonical false then upserts new canonical slug', async () => {
    prisma.slug.updateMany.mockResolvedValue({ count: 1 });
    prisma.slug.upsert.mockResolvedValue({});

    await setSlug('product', 'prod_1', 'en', 'new-slug');

    expect(prisma.slug.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'product', entityId: 'prod_1', locale: 'en', canonical: true },
      data: { canonical: false },
    });
    expect(prisma.slug.upsert).toHaveBeenCalledWith({
      where: { slug: 'new-slug' },
      create: { entityType: 'product', entityId: 'prod_1', locale: 'en', slug: 'new-slug', canonical: true },
      update: { entityType: 'product', entityId: 'prod_1', locale: 'en', canonical: true },
    });
  });
});

// ---------------------------------------------------------------------------
// setTranslation
// ---------------------------------------------------------------------------

describe('setTranslation', () => {
  it('calls prisma.translation.upsert with correct composite key', async () => {
    prisma.translation.upsert.mockResolvedValue({});

    await setTranslation('product', 'prod_1', 'en', 'title', 'Cool Shirt');

    expect(prisma.translation.upsert).toHaveBeenCalledWith({
      where: {
        entityType_entityId_locale_field: {
          entityType: 'product',
          entityId: 'prod_1',
          locale: 'en',
          field: 'title',
        },
      },
      create: { entityType: 'product', entityId: 'prod_1', locale: 'en', field: 'title', value: 'Cool Shirt' },
      update: { value: 'Cool Shirt' },
    });
  });
});

// ---------------------------------------------------------------------------
// getTranslations
// ---------------------------------------------------------------------------

describe('getTranslations', () => {
  it('returns a field-to-value map from translation rows', async () => {
    prisma.translation.findMany.mockResolvedValue([
      { field: 'title', value: 'Cool Shirt' },
      { field: 'description', value: 'A very cool shirt.' },
    ]);

    const result = await getTranslations('product', 'prod_1', 'en');

    expect(result).toEqual({
      title: 'Cool Shirt',
      description: 'A very cool shirt.',
    });
  });

  it('returns empty object when no translations exist', async () => {
    prisma.translation.findMany.mockResolvedValue([]);

    const result = await getTranslations('product', 'missing_id', 'fr');

    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// listProducts
// ---------------------------------------------------------------------------

describe('listProducts', () => {
  it('applies published=true filter (publishedAt not null)', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await listProducts({ published: true });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: { not: null } },
      })
    );
  });

  it('applies published=false filter (publishedAt null)', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await listProducts({ published: false });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: null },
      })
    );
  });

  it('uses page and limit for pagination', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await listProducts({ page: 3, limit: 10 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it('returns products with translations when locale is provided', async () => {
    const product = { id: 'prod_1', publishedAt: new Date(), variants: [], media: [] };
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.translation.findMany.mockResolvedValue([{ field: 'title', value: 'Localised Title' }]);
    prisma.slug.findFirst.mockResolvedValue({ slug: 'localised-title' });

    const result = await listProducts({ locale: 'en' });

    expect(result[0].title).toBe('Localised Title');
    expect(result[0].slug).toBe('localised-title');
  });
});

// ---------------------------------------------------------------------------
// publishProduct / unpublishProduct
// ---------------------------------------------------------------------------

describe('publishProduct', () => {
  it('sets publishedAt to a Date', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod_1', publishedAt: new Date() });

    await publishProduct('prod_1');

    const call = prisma.product.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'prod_1' });
    expect(call.data.publishedAt).toBeInstanceOf(Date);
  });
});

describe('unpublishProduct', () => {
  it('sets publishedAt to null', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod_1', publishedAt: null });

    await unpublishProduct('prod_1');

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { publishedAt: null },
    });
  });
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

describe('attachMedia', () => {
  it('upserts productMedia with given position', async () => {
    prisma.productMedia.upsert.mockResolvedValue({});

    await attachMedia('prod_1', 'media_1', 2);

    expect(prisma.productMedia.upsert).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId: 'prod_1', mediaId: 'media_1' } },
      create: { productId: 'prod_1', mediaId: 'media_1', position: 2 },
      update: { position: 2 },
    });
  });
});

describe('reorderMedia', () => {
  it('updates position for each mediaId in order via $transaction', async () => {
    prisma.productMedia.update.mockResolvedValue({});
    // $transaction receives an array; mock resolves each element.
    prisma.$transaction.mockImplementation((ops) => Promise.all(ops));

    await reorderMedia('prod_1', ['media_a', 'media_b', 'media_c']);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.productMedia.update).toHaveBeenCalledTimes(3);
    expect(prisma.productMedia.update).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId: 'prod_1', mediaId: 'media_a' } },
      data: { position: 0 },
    });
    expect(prisma.productMedia.update).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId: 'prod_1', mediaId: 'media_c' } },
      data: { position: 2 },
    });
  });
});
