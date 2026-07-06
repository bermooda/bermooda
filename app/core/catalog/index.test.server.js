// app/core/catalog/index.test.server.js

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
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
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

vi.mock('#/core/events/index.server', () => ({
  emit: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { emit } from '#/core/events/index.server';

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
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  publishProduct,
  unpublishProduct,
  attachMedia,
  reorderMedia,
  detachMedia,
  listCategories,
  getCategory,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
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
    expect(prisma.slug.findUnique).toHaveBeenCalledWith({
      where: { slug: 'no-such-slug' },
    });
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

    expect(result).toEqual({
      entityType: 'product',
      entityId: 'prod_1',
      locale: 'en',
    });
  });
});

// ---------------------------------------------------------------------------
// setSlug
// ---------------------------------------------------------------------------

describe('setSlug', () => {
  it('upserts slug by compound (entityType, entityId, locale) key', async () => {
    prisma.slug.findUnique.mockResolvedValue(null);
    prisma.slug.upsert.mockResolvedValue({});

    await setSlug('product', 'prod_1', 'en', 'new-slug');

    expect(prisma.slug.findUnique).toHaveBeenCalledWith({
      where: { slug: 'new-slug' },
    });
    expect(prisma.slug.upsert).toHaveBeenCalledWith({
      where: {
        entityType_entityId_locale: {
          entityType: 'product',
          entityId: 'prod_1',
          locale: 'en',
        },
      },
      create: {
        entityType: 'product',
        entityId: 'prod_1',
        locale: 'en',
        slug: 'new-slug',
        canonical: true,
      },
      update: { slug: 'new-slug', canonical: true },
    });
  });

  it('throws when the slug belongs to a different entity', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'category',
      entityId: 'cat_99',
      locale: 'en',
      slug: 'new-slug',
      canonical: true,
    });

    await expect(
      setSlug('product', 'prod_1', 'en', 'new-slug')
    ).rejects.toThrow('Slug already taken');
    expect(prisma.slug.upsert).not.toHaveBeenCalled();
  });

  it('does not throw when the slug already belongs to the same entity', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'product',
      entityId: 'prod_1',
      locale: 'en',
      slug: 'new-slug',
      canonical: true,
    });
    prisma.slug.upsert.mockResolvedValue({});

    await expect(
      setSlug('product', 'prod_1', 'en', 'new-slug')
    ).resolves.toBeUndefined();
    expect(prisma.slug.upsert).toHaveBeenCalled();
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
      create: {
        entityType: 'product',
        entityId: 'prod_1',
        locale: 'en',
        field: 'title',
        value: 'Cool Shirt',
      },
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
    const product = {
      id: 'prod_1',
      publishedAt: new Date(),
      variants: [],
      media: [],
    };
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.translation.findMany.mockResolvedValue([
      { field: 'title', value: 'Localised Title' },
    ]);
    prisma.slug.findFirst.mockResolvedValue({ slug: 'localised-title' });

    const { products } = await listProducts({ locale: 'en' });

    expect(products[0].title).toBe('Localised Title');
    expect(products[0].slug).toBe('localised-title');
  });
});

// ---------------------------------------------------------------------------
// publishProduct / unpublishProduct
// ---------------------------------------------------------------------------

describe('publishProduct', () => {
  it('sets publishedAt to a Date', async () => {
    prisma.product.update.mockResolvedValue({
      id: 'prod_1',
      publishedAt: new Date(),
    });

    await publishProduct('prod_1');

    const call = prisma.product.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'prod_1' });
    expect(call.data.publishedAt).toBeInstanceOf(Date);
  });
});

describe('unpublishProduct', () => {
  it('sets publishedAt to null', async () => {
    prisma.product.update.mockResolvedValue({
      id: 'prod_1',
      publishedAt: null,
    });

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

describe('detachMedia', () => {
  it('deletes productMedia by compound key', async () => {
    prisma.productMedia.delete.mockResolvedValue({});

    await detachMedia('prod_1', 'media_1');

    expect(prisma.productMedia.delete).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId: 'prod_1', mediaId: 'media_1' } },
    });
  });
});

// ---------------------------------------------------------------------------
// getProduct
// ---------------------------------------------------------------------------

describe('getProduct', () => {
  it('returns null when product not found', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const result = await getProduct('prod_missing');

    expect(result).toBeNull();
  });

  it('returns product without translations when no locale provided', async () => {
    const product = {
      id: 'prod_1',
      publishedAt: null,
      variants: [],
      media: [],
      categories: [],
      options: [],
    };
    prisma.product.findUnique.mockResolvedValue(product);

    const result = await getProduct('prod_1');

    expect(result).toEqual(product);
    expect(prisma.translation.findMany).not.toHaveBeenCalled();
  });

  it('merges translations when locale provided', async () => {
    const product = {
      id: 'prod_1',
      publishedAt: null,
      variants: [],
      media: [],
      options: [],
      categories: [],
    };
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.translation.findMany.mockResolvedValue([
      { field: 'title', value: 'Product Title' },
    ]);
    prisma.slug.findFirst.mockResolvedValue({ slug: 'product-title' });

    const result = await getProduct('prod_1', { locale: 'en' });

    expect(result.title).toBe('Product Title');
    expect(result.slug).toBe('product-title');
  });
});

// ---------------------------------------------------------------------------
// getProductBySlug
// ---------------------------------------------------------------------------

describe('getProductBySlug', () => {
  it('returns null when slug does not resolve', async () => {
    prisma.slug.findUnique.mockResolvedValue(null);

    const result = await getProductBySlug('no-such-slug');

    expect(result).toBeNull();
  });

  it('returns null when slug resolves to a category, not a product', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'category',
      entityId: 'cat_1',
      locale: 'en',
      slug: 'a-cat',
    });

    const result = await getProductBySlug('a-cat');

    expect(result).toBeNull();
  });

  it('returns product when slug resolves to a product', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'product',
      entityId: 'prod_1',
      locale: 'en',
      slug: 'cool-shirt',
    });
    const product = {
      id: 'prod_1',
      variants: [],
      media: [],
      categories: [],
      options: [],
    };
    prisma.product.findUnique.mockResolvedValue(product);

    const result = await getProductBySlug('cool-shirt');

    expect(result).toEqual(product);
  });
});

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------

describe('createProduct', () => {
  it('creates a product and stores title translation when locale provided', async () => {
    prisma.product.create.mockResolvedValue({ id: 'prod_new' });
    prisma.translation.upsert.mockResolvedValue({});

    const result = await createProduct({ locale: 'en', title: 'New Shirt' });

    expect(prisma.product.create).toHaveBeenCalled();
    expect(prisma.translation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          entityType: 'product',
          entityId: 'prod_new',
          locale: 'en',
          field: 'title',
          value: 'New Shirt',
        }),
      })
    );
    expect(result.id).toBe('prod_new');
  });

  it('creates a product without translations when no locale', async () => {
    prisma.product.create.mockResolvedValue({ id: 'prod_no_locale' });

    await createProduct({});

    expect(prisma.product.create).toHaveBeenCalled();
    expect(prisma.translation.upsert).not.toHaveBeenCalled();
  });

  it('throws when prices are passed (prices must be set per-variant)', async () => {
    await expect(
      createProduct({ prices: [{ currency: 'USD', priceCents: 1000 }] })
    ).rejects.toThrow(/prices must be set per-variant/);
  });

  it('emits product.created after creating a product', async () => {
    prisma.product.create.mockResolvedValue({ id: 'prod_new' });

    await createProduct({});

    expect(emit).toHaveBeenCalledWith('product.created', {
      productId: 'prod_new',
    });
  });
});

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------

describe('updateProduct', () => {
  it('updates product fields and title translation when locale provided', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod_1' });
    prisma.translation.upsert.mockResolvedValue({});

    await updateProduct('prod_1', { locale: 'en', title: 'Updated Shirt' });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: {},
    });
    expect(prisma.translation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          field: 'title',
          value: 'Updated Shirt',
        }),
      })
    );
  });

  it('does not update translations when no locale provided', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod_1' });

    await updateProduct('prod_1', { position: 2 });

    expect(prisma.translation.upsert).not.toHaveBeenCalled();
  });

  it('emits product.updated after updating a product', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod_1' });

    await updateProduct('prod_1', { position: 2 });

    expect(emit).toHaveBeenCalledWith('product.updated', {
      productId: 'prod_1',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteProduct
// ---------------------------------------------------------------------------

describe('deleteProduct', () => {
  it('calls prisma.product.delete', async () => {
    prisma.product.delete.mockResolvedValue({});

    await deleteProduct('prod_1');

    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
    });
  });

  it('emits product.deleted after deleting a product', async () => {
    prisma.product.delete.mockResolvedValue({});

    await deleteProduct('prod_1');

    expect(emit).toHaveBeenCalledWith('product.deleted', {
      productId: 'prod_1',
    });
  });
});

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

describe('listCategories', () => {
  it('returns categories without translations when no locale', async () => {
    const cats = [{ id: 'cat_1', children: [] }];
    prisma.category.findMany.mockResolvedValue(cats);

    const result = await listCategories();

    expect(result).toEqual(cats);
    expect(prisma.translation.findMany).not.toHaveBeenCalled();
  });

  it('merges translations and slugs when locale provided', async () => {
    const cats = [{ id: 'cat_1', children: [{ id: 'cat_2' }] }];
    prisma.category.findMany.mockResolvedValue(cats);
    prisma.translation.findMany.mockResolvedValue([
      { entityId: 'cat_1', field: 'name', value: 'Category One' },
    ]);
    prisma.slug.findMany.mockResolvedValue([
      { entityId: 'cat_1', slug: 'category-one' },
    ]);

    const result = await listCategories({ locale: 'en' });

    expect(result[0].name).toBe('Category One');
    expect(result[0].slug).toBe('category-one');
  });
});

// ---------------------------------------------------------------------------
// getCategory
// ---------------------------------------------------------------------------

describe('getCategory', () => {
  it('returns null when category not found', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    const result = await getCategory('cat_missing');

    expect(result).toBeNull();
  });

  it('returns category without translations when no locale', async () => {
    const cat = { id: 'cat_1', children: [], products: [] };
    prisma.category.findUnique.mockResolvedValue(cat);

    const result = await getCategory('cat_1');

    expect(result).toEqual(cat);
  });

  it('merges translations when locale provided', async () => {
    const cat = { id: 'cat_1', children: [], products: [] };
    prisma.category.findUnique.mockResolvedValue(cat);
    prisma.translation.findMany.mockResolvedValue([
      { field: 'name', value: 'Shirts' },
    ]);
    prisma.slug.findFirst.mockResolvedValue({ slug: 'shirts' });

    const result = await getCategory('cat_1', { locale: 'en' });

    expect(result.name).toBe('Shirts');
    expect(result.slug).toBe('shirts');
  });
});

// ---------------------------------------------------------------------------
// getCategoryBySlug
// ---------------------------------------------------------------------------

describe('getCategoryBySlug', () => {
  it('returns null when slug does not resolve', async () => {
    prisma.slug.findUnique.mockResolvedValue(null);

    const result = await getCategoryBySlug('no-slug');

    expect(result).toBeNull();
  });

  it('returns null when slug resolves to a product', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'product',
      entityId: 'prod_1',
      locale: 'en',
      slug: 'a-product',
    });

    const result = await getCategoryBySlug('a-product');

    expect(result).toBeNull();
  });

  it('returns category when slug resolves to a category', async () => {
    prisma.slug.findUnique.mockResolvedValue({
      entityType: 'category',
      entityId: 'cat_1',
      locale: 'en',
      slug: 'shirts',
    });
    const cat = { id: 'cat_1', children: [], products: [] };
    prisma.category.findUnique.mockResolvedValue(cat);

    const result = await getCategoryBySlug('shirts');

    expect(result).toEqual(cat);
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe('createCategory', () => {
  it('creates a category with name translation and slug', async () => {
    prisma.category.create.mockResolvedValue({ id: 'cat_new' });
    prisma.translation.upsert.mockResolvedValue({});
    prisma.slug.findUnique.mockResolvedValue(null);
    prisma.slug.upsert.mockResolvedValue({});

    await createCategory({
      locale: 'en',
      name: 'Electronics',
      slug: 'electronics',
    });

    expect(prisma.category.create).toHaveBeenCalled();
    expect(prisma.translation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          entityId: 'cat_new',
          field: 'name',
          value: 'Electronics',
        }),
      })
    );
    expect(prisma.slug.upsert).toHaveBeenCalled();
  });

  it('creates a category without translation when no locale', async () => {
    prisma.category.create.mockResolvedValue({ id: 'cat_new' });

    await createCategory({});

    expect(prisma.translation.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

describe('updateCategory', () => {
  it('updates category and translation when locale provided', async () => {
    prisma.category.update.mockResolvedValue({ id: 'cat_1' });
    prisma.translation.upsert.mockResolvedValue({});

    await updateCategory('cat_1', { locale: 'en', name: 'Updated Category' });

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat_1' },
      data: {},
    });
    expect(prisma.translation.upsert).toHaveBeenCalled();
  });

  it('updates slug when locale and slug provided', async () => {
    prisma.category.update.mockResolvedValue({ id: 'cat_1' });
    prisma.translation.upsert.mockResolvedValue({});
    prisma.slug.findUnique.mockResolvedValue(null);
    prisma.slug.upsert.mockResolvedValue({});

    await updateCategory('cat_1', {
      locale: 'en',
      name: 'Name',
      slug: 'new-slug',
    });

    expect(prisma.slug.upsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe('deleteCategory', () => {
  it('calls prisma.category.delete', async () => {
    prisma.category.delete.mockResolvedValue({});

    await deleteCategory('cat_1');

    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: 'cat_1' },
    });
  });
});
