// app/core/content/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    page: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    slug: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    translation: { deleteMany: vi.fn(), findMany: vi.fn() },
    menu: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    menuItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    category: { findMany: vi.fn() },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('#/core/catalog/index.server', () => ({
  getTranslations: vi.fn(),
  resolveSlug: vi.fn(),
  setSlug: vi.fn(),
  setTranslation: vi.fn(),
}));

vi.mock('#/core/catalog/translations.server', () => ({
  loadCategoryTitleMap: vi.fn(),
  loadPageTitleMap: vi.fn(),
  withTranslations: vi.fn((base, translations) => ({
    ...base,
    ...translations,
  })),
}));

vi.mock('#/core/i18n/index.server', () => ({
  getAvailableLocales: vi.fn().mockResolvedValue(['en']),
}));

import prisma from '#/libs/prisma.server';
import {
  getTranslations,
  resolveSlug,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import { loadPageTitleMap } from '#/core/catalog/translations.server';
import {
  buildPageSearchWhere,
  createPage,
  deletePage,
  getPageBySlug,
  isReservedPageSlug,
  listPages,
  listPagesAdmin,
  parseCreatePageInput,
  parseMenuFormInput,
  parsePageFormInput,
  parsePageListParams,
  parseUpdatePageInput,
  serializePageListItem,
  updatePage,
  validatePageSlug,
} from '#/core/content/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isReservedPageSlug', () => {
  it('blocks reserved slugs', () => {
    expect(isReservedPageSlug('cart')).toBe(true);
    expect(isReservedPageSlug('about')).toBe(false);
  });
});

describe('validatePageSlug', () => {
  it('rejects invalid slugs', () => {
    expect(() => validatePageSlug('')).toThrow(/Slug is required/);
    expect(() => validatePageSlug('About Us')).toThrow(/lowercase/);
    expect(() => validatePageSlug('cart')).toThrow(/reserved/);
  });

  it('accepts valid slugs', () => {
    expect(validatePageSlug('about-us')).toBe('about-us');
  });
});

describe('parsePageListParams', () => {
  it('parses pagination and filters', () => {
    const params = parsePageListParams(
      new URLSearchParams('page=2&limit=10&status=published&q=about')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      status: 'published',
      q: 'about',
    });
  });

  it('rejects invalid status', () => {
    expect(() =>
      parsePageListParams(new URLSearchParams('status=archived'))
    ).toThrow(/Invalid page status/);
  });
});

describe('parseCreatePageInput', () => {
  it('requires title when slug is provided', () => {
    expect(() =>
      parseCreatePageInput({ slug: 'about', translations: { title: ' ' } })
    ).toThrow(/Title is required/);
  });
});

describe('parsePageFormInput', () => {
  it('parses delete intent', () => {
    const formData = new FormData();
    formData.set('intent', 'delete');
    expect(parsePageFormInput(formData)).toEqual({ intent: 'delete' });
  });

  it('parses update fields', () => {
    const formData = new FormData();
    formData.set('locale', 'en');
    formData.set('status', 'published');
    formData.set('slug', 'about');
    formData.set('title', 'About');
    formData.set('body', 'Hello');

    expect(parsePageFormInput(formData)).toEqual({
      locale: 'en',
      status: 'published',
      slug: 'about',
      translations: {
        title: 'About',
        body: 'Hello',
        metaTitle: '',
        metaDescription: '',
      },
    });
  });
});

describe('parseMenuFormInput', () => {
  it('skips empty menu items', () => {
    const formData = new FormData();
    formData.set('handle', 'main');
    formData.set('title', 'Main menu');
    formData.set('itemCount', '2');
    formData.set('items[0][label]', 'Home');
    formData.set('items[0][url]', '/');
    formData.set('items[0][position]', '0');

    const parsed = parseMenuFormInput(formData);
    expect(parsed.handle).toBe('main');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ label: 'Home', url: '/' });
  });
});

describe('serializePageListItem', () => {
  it('serializes timestamps and optional title/slug', () => {
    const serialized = serializePageListItem(
      {
        id: 'page_1',
        status: 'draft',
        type: 'page',
        publishedAt: null,
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      { title: 'About', slug: 'about' }
    );

    expect(serialized).toEqual({
      id: 'page_1',
      title: 'About',
      slug: 'about',
      status: 'draft',
      type: 'page',
      publishedAt: null,
      updatedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('buildPageSearchWhere', () => {
  it('filters by slug search', async () => {
    prisma.slug.findMany.mockResolvedValue([
      { entityId: 'page_1' },
      { entityId: 'page_2' },
    ]);

    const where = await buildPageSearchWhere({ q: 'about' });
    expect(where).toEqual({ id: { in: ['page_1', 'page_2'] } });
  });
});

describe('getPageBySlug', () => {
  it('returns null for reserved slugs', async () => {
    const result = await getPageBySlug('search');
    expect(result).toBeNull();
    expect(resolveSlug).not.toHaveBeenCalled();
  });

  it('returns null for draft pages on storefront', async () => {
    resolveSlug.mockResolvedValue({
      entityType: 'page',
      entityId: 'page_1',
      locale: 'en',
    });
    prisma.page.findUnique.mockResolvedValue({
      id: 'page_1',
      status: 'draft',
    });

    const result = await getPageBySlug('about', { requirePublished: true });
    expect(result).toBeNull();
  });

  it('returns published page with translations', async () => {
    resolveSlug.mockResolvedValue({
      entityType: 'page',
      entityId: 'page_1',
      locale: 'en',
    });
    prisma.page.findUnique.mockResolvedValue({
      id: 'page_1',
      status: 'published',
      title: 'ignored',
    });
    getTranslations.mockResolvedValue({ title: 'About', body: 'Hello' });
    prisma.slug.findFirst.mockResolvedValue({ slug: 'about' });

    const result = await getPageBySlug('about', { locale: 'en' });
    expect(result.title).toBe('About');
    expect(result.slug).toBe('about');
  });
});

describe('createPage', () => {
  it('creates draft page with translations and slug', async () => {
    prisma.page.create.mockResolvedValue({ id: 'page_new', status: 'draft' });

    await createPage({
      slug: 'about',
      locale: 'en',
      translations: { title: 'About' },
    });

    expect(setTranslation).toHaveBeenCalledWith(
      'page',
      'page_new',
      'en',
      'title',
      'About'
    );
    expect(setSlug).toHaveBeenCalledWith('page', 'page_new', 'en', 'about');
  });
});

describe('updatePage', () => {
  it('throws when page is missing', async () => {
    prisma.page.findUnique.mockResolvedValue(null);
    await expect(
      updatePage('missing', { status: 'draft' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('deletePage', () => {
  it('throws when page is missing', async () => {
    prisma.page.findUnique.mockResolvedValue(null);
    await expect(deletePage('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('listPages', () => {
  it('paginates admin list with serialized titles', async () => {
    prisma.page.findMany.mockResolvedValue([{ id: 'p1', status: 'draft' }]);
    prisma.page.count.mockResolvedValue(1);
    loadPageTitleMap.mockResolvedValue(new Map([['p1', 'About']]));
    prisma.slug.findMany.mockResolvedValue([{ entityId: 'p1', slug: 'about' }]);

    const result = await listPages({ page: 1, limit: 20 });
    expect(result.pages).toEqual([
      expect.objectContaining({ id: 'p1', title: 'About', slug: 'about' }),
    ]);
    expect(result.total).toBe(1);
  });
});

describe('listPagesAdmin', () => {
  it('returns status counts for admin index', async () => {
    prisma.page.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.page.findMany.mockResolvedValue([{ id: 'p1', status: 'published' }]);
    loadPageTitleMap.mockResolvedValue(new Map());
    prisma.slug.findMany.mockResolvedValue([]);

    const result = await listPagesAdmin(new URLSearchParams());
    expect(result.total).toBe(3);
    expect(result.publishedCount).toBe(2);
    expect(result.draftCount).toBe(1);
    expect(result.pages).toHaveLength(1);
  });
});

describe('parseUpdatePageInput', () => {
  it('rejects reserved slug updates', () => {
    expect(() => parseUpdatePageInput({ slug: 'cart' })).toThrow(/reserved/);
  });
});
