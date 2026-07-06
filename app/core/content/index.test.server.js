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
    slug: { findFirst: vi.fn() },
    translation: { deleteMany: vi.fn() },
    menu: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    menuItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
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

import prisma from '#/libs/prisma.server';
import {
  getTranslations,
  resolveSlug,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import {
  createPage,
  getPageBySlug,
  isReservedPageSlug,
  listPages,
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

describe('listPages', () => {
  it('paginates admin list', async () => {
    prisma.page.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.page.count.mockResolvedValue(1);

    const result = await listPages({ page: 1, limit: 20 });
    expect(result.pages).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
