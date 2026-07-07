import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    translation: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    slug: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock('#/core/catalog/translations.server', () => ({
  loadCategoryTitleMap: vi.fn(),
  loadProductTitleMap: vi.fn(),
  setTranslation: vi.fn(),
}));

vi.mock('#/core/catalog/index.server', () => ({
  setSlug: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import {
  createCategoryFromAdminInput,
  loadCategoryAdminTreeData,
  loadProductsAdminIndexData,
  parseCategoryCreateInput,
  reorderCategory,
} from '#/core/catalog/admin.server';
import { setSlug } from '#/core/catalog/index.server';
import {
  loadCategoryTitleMap,
  loadProductTitleMap,
  setTranslation,
} from '#/core/catalog/translations.server';
import { get } from '#/core/settings/index.server';

describe('catalog admin helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(['en']);
    loadCategoryTitleMap.mockResolvedValue(new Map());
    loadProductTitleMap.mockResolvedValue(new Map());
  });

  it('loadProductsAdminIndexData returns paginated rows', async () => {
    prisma.product.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod_1',
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        variants: [{ id: 'var_1' }],
        categories: [{ categoryId: 'cat_1' }],
      },
    ]);
    loadProductTitleMap.mockResolvedValue(new Map([['prod_1', 'Shirt']]));
    loadCategoryTitleMap.mockResolvedValue(new Map([['cat_1', 'Apparel']]));
    prisma.slug.findMany.mockResolvedValue([
      { entityId: 'prod_1', slug: 'shirt' },
    ]);

    const result = await loadProductsAdminIndexData({ page: 1, limit: 20 });

    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 'prod_1',
        title: 'Shirt',
        slug: 'shirt',
        variantCount: 1,
        categories: [{ id: 'cat_1', title: 'Apparel' }],
      }),
    ]);
    expect(result.total).toBe(1);
    expect(result.publishedCount).toBe(1);
    expect(result.draftCount).toBe(0);
  });

  it('loadCategoryAdminTreeData builds nested tree rows', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat_root', parentId: null, position: 0 },
      { id: 'cat_child', parentId: 'cat_root', position: 0 },
    ]);
    prisma.translation.findMany.mockResolvedValue([
      {
        entityId: 'cat_root',
        locale: 'en',
        field: 'title',
        value: 'Root',
      },
      {
        entityId: 'cat_child',
        locale: 'en',
        field: 'title',
        value: 'Child',
      },
    ]);
    prisma.slug.findMany.mockResolvedValue([]);

    const result = await loadCategoryAdminTreeData();

    expect(result.locales).toEqual(['en']);
    expect(result.tree).toHaveLength(2);
    expect(result.tree[0]).toMatchObject({
      id: 'cat_root',
      depth: 0,
      enTitle: 'Root',
      childCount: 1,
    });
    expect(result.tree[1]).toMatchObject({
      id: 'cat_child',
      depth: 1,
      enTitle: 'Child',
    });
  });

  it('parseCategoryCreateInput validates required title', () => {
    const formData = new FormData();
    expect(parseCategoryCreateInput(formData)).toEqual({
      error: 'Name is required.',
    });
  });

  it('createCategoryFromAdminInput creates category and translation', async () => {
    prisma.category.findFirst.mockResolvedValue({ position: 2 });
    prisma.category.create.mockResolvedValue({ id: 'cat_new' });

    await createCategoryFromAdminInput({
      title: 'Accessories',
      slugValue: 'accessories',
      parentId: null,
    });

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { parentId: null, position: 3 },
    });
    expect(setTranslation).toHaveBeenCalledWith(
      'category',
      'cat_new',
      'en',
      'title',
      'Accessories'
    );
    expect(setSlug).toHaveBeenCalledWith(
      'category',
      'cat_new',
      'en',
      'accessories'
    );
  });

  it('reorderCategory swaps sibling positions', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat_b',
      parentId: null,
      position: 1,
    });
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat_a', position: 0 },
      { id: 'cat_b', position: 1 },
    ]);

    const result = await reorderCategory('cat_b', 'reorder-up');

    expect(result).toEqual({ moved: true });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
