// app/core/content/index.server.js
// CMS pages and navigation menus.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import {
  getTranslations,
  resolveSlug,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import { withTranslations } from '#/core/catalog/translations.server';

export const RESERVED_PAGE_SLUGS = new Set([
  'search',
  'cart',
  'checkout',
  'account',
  'admin',
  'api',
  'health',
  'sitemap.xml',
  'products',
  'categories',
  'apps',
  'thank-you',
  'webhooks',
]);

const PAGE_FIELDS = ['title', 'body', 'metaTitle', 'metaDescription'];

async function attachPageLocale(page, locale) {
  const [translations, slugRow] = await Promise.all([
    getTranslations('page', page.id, locale),
    prisma.slug.findFirst({
      where: { entityType: 'page', entityId: page.id, locale, canonical: true },
    }),
  ]);
  return withTranslations(
    { ...page, slug: slugRow?.slug ?? null },
    translations
  );
}

async function savePageTranslations(pageId, locale, translations = {}) {
  for (const field of PAGE_FIELDS) {
    if (translations[field] !== undefined) {
      await setTranslation('page', pageId, locale, field, translations[field]);
    }
  }
}

export function isReservedPageSlug(slug) {
  return RESERVED_PAGE_SLUGS.has(slug);
}

export async function listPages({ status, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status) where.status = status;

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.page.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.page.count({ where }),
  ]);

  return { pages: rows, total };
}

export async function getPage(id, { locale } = {}) {
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) return null;
  if (!locale) return page;
  return attachPageLocale(page, locale);
}

export async function getPageBySlug(
  slug,
  { locale, requirePublished = true } = {}
) {
  if (isReservedPageSlug(slug)) return null;

  const resolved = await resolveSlug(slug);
  if (!resolved || resolved.entityType !== 'page') return null;

  const page = await prisma.page.findUnique({
    where: { id: resolved.entityId },
  });
  if (!page) return null;
  if (requirePublished && page.status !== 'published') return null;

  const effectiveLocale = locale ?? resolved.locale;
  return attachPageLocale(page, effectiveLocale);
}

export async function createPage({
  translations = {},
  slug,
  locale = 'en',
  type = 'page',
  status = 'draft',
} = {}) {
  if (slug && isReservedPageSlug(slug)) {
    throw new Error('Slug is reserved');
  }

  const page = await prisma.page.create({
    data: {
      type,
      status,
      publishedAt: status === 'published' ? new Date() : null,
    },
  });

  await savePageTranslations(page.id, locale, translations);
  if (slug) {
    await setSlug('page', page.id, locale, slug);
  }

  logger.info({ pageId: page.id }, 'page created');
  return page;
}

export async function updatePage(
  id,
  { translations, slug, locale = 'en', type, status } = {}
) {
  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) throw new Error('Page not found');

  if (slug && isReservedPageSlug(slug)) {
    throw new Error('Slug is reserved');
  }

  const data = {};
  if (type !== undefined) data.type = type;
  if (status !== undefined) {
    data.status = status;
    if (status === 'published' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
    if (status === 'draft') {
      data.publishedAt = null;
    }
  }

  const page =
    Object.keys(data).length > 0
      ? await prisma.page.update({ where: { id }, data })
      : existing;

  if (translations) {
    await savePageTranslations(id, locale, translations);
  }
  if (slug) {
    await setSlug('page', id, locale, slug);
  }

  return page;
}

export async function deletePage(id) {
  await prisma.$transaction([
    prisma.translation.deleteMany({
      where: { entityType: 'page', entityId: id },
    }),
    prisma.slug.deleteMany({ where: { entityType: 'page', entityId: id } }),
    prisma.page.delete({ where: { id } }),
  ]);
  logger.info({ pageId: id }, 'page deleted');
}

export async function listPublishedPages({ locale = 'en' } = {}) {
  const pages = await prisma.page.findMany({
    where: { status: 'published' },
    orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }],
  });

  return Promise.all(
    pages.map(async (page) => {
      const slugRow = await prisma.slug.findFirst({
        where: {
          entityType: 'page',
          entityId: page.id,
          locale,
          canonical: true,
        },
      });
      return { ...page, slug: slugRow?.slug ?? null };
    })
  );
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

async function resolveMenuItemLabel(item, locale) {
  const translations = await getTranslations('menu_item', item.id, locale);
  return translations.label || item.label;
}

export async function resolveMenuItemUrl(item, { locale = 'en' } = {}) {
  if (item.pageId) {
    const slugRow = await prisma.slug.findFirst({
      where: {
        entityType: 'page',
        entityId: item.pageId,
        locale,
        canonical: true,
      },
    });
    if (slugRow?.slug) return `/${slugRow.slug}`;
  }

  if (item.categoryId) {
    const slugRow = await prisma.slug.findFirst({
      where: {
        entityType: 'category',
        entityId: item.categoryId,
        locale,
        canonical: true,
      },
    });
    if (slugRow?.slug) return `/categories/${slugRow.slug}`;
  }

  return item.url ?? '#';
}

async function buildMenuTree(items, locale) {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const roots = sorted.filter((item) => !item.parentId);

  async function mapItem(item) {
    const children = sorted.filter((child) => child.parentId === item.id);
    return {
      id: item.id,
      label: await resolveMenuItemLabel(item, locale),
      url: await resolveMenuItemUrl(item, { locale }),
      openInNew: item.openInNew,
      children: await Promise.all(children.map(mapItem)),
    };
  }

  return Promise.all(roots.map(mapItem));
}

export async function listMenus() {
  const menus = await prisma.menu.findMany({
    orderBy: { handle: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  return menus.map((menu) => ({
    id: menu.id,
    handle: menu.handle,
    title: menu.title,
    itemCount: menu._count.items,
  }));
}

export async function getMenuByHandle(handle, { locale = 'en' } = {}) {
  const menu = await prisma.menu.findUnique({
    where: { handle },
    include: { items: true },
  });
  if (!menu) return null;

  const items = await buildMenuTree(menu.items, locale);
  return { id: menu.id, handle: menu.handle, title: menu.title, items };
}

export async function upsertMenu(handle, { title, items = [] } = {}) {
  const menu = await prisma.menu.upsert({
    where: { handle },
    create: { handle, title: title ?? handle },
    update: { title: title ?? handle },
  });

  await prisma.menuItem.deleteMany({ where: { menuId: menu.id } });

  for (const item of items) {
    await prisma.menuItem.create({
      data: {
        menuId: menu.id,
        parentId: item.parentId ?? null,
        label: item.label ?? '',
        url: item.url ?? null,
        pageId: item.pageId ?? null,
        categoryId: item.categoryId ?? null,
        position: item.position ?? 0,
        openInNew: item.openInNew ?? false,
      },
    });
  }

  return menu;
}

export async function getMenuForAdmin(handle) {
  const menu = await prisma.menu.findUnique({
    where: { handle },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  return menu;
}
