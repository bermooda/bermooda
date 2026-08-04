// app/core/content/menus.server.js
// Navigation menu parse/serialize helpers and CRUD.

import prisma from '#/libs/prisma.server';
import { getTranslations } from '#/core/catalog/index.server';
import {
  loadCategoryTitleMap,
  loadPageTitleMap,
} from '#/core/catalog/translations.server';

export const DEFAULT_MENU_HANDLES = ['main', 'footer', 'sub-header'];

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse admin menu editor form data.
 *
 * @param {FormData} formData
 */
export function parseMenuFormInput(formData) {
  const handle = formData.get('handle')?.toString() ?? 'main';
  const title = formData.get('title')?.toString() ?? handle;
  const itemCount = parseInt(formData.get('itemCount')?.toString() ?? '0', 10);

  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const label = formData.get(`items[${i}][label]`)?.toString() ?? '';
    const url = formData.get(`items[${i}][url]`)?.toString().trim() || null;
    const pageId = formData.get(`items[${i}][pageId]`)?.toString() || null;
    const categoryId =
      formData.get(`items[${i}][categoryId]`)?.toString() || null;
    const position = parseInt(
      formData.get(`items[${i}][position]`)?.toString() ?? String(i),
      10
    );
    const openInNew = formData.get(`items[${i}][openInNew]`) === 'on';

    if (!label && !pageId && !categoryId && !url) continue;

    items.push({
      label,
      url: pageId || categoryId ? null : url,
      pageId,
      categoryId,
      position,
      openInNew,
    });
  }

  return { handle, title, items };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a menu for admin/API responses.
 *
 * @param {object} record
 */
export function serializeMenu(record) {
  return {
    id: record.id,
    handle: record.handle,
    title: record.title,
    itemCount:
      record._count?.items ?? record.itemCount ?? record.items?.length ?? 0,
    items: record.items,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * @param {object} item
 * @param {string} locale
 * @returns {Promise<string>}
 */
async function resolveMenuItemLabel(item, locale) {
  const translations = await getTranslations('menu_item', item.id, locale);
  return translations.label || item.label;
}

/**
 * @param {object} item
 * @param {{ locale?: string }} [options]
 * @returns {Promise<string>}
 */
async function resolveMenuItemUrl(item, { locale = 'en' } = {}) {
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

/**
 * @param {object[]} items
 * @param {string} locale
 */
async function buildMenuTree(items, locale) {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const roots = sorted.filter((item) => !item.parentId);

  /**
   * @param {object} item
   */
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

/**
 * @param {string} handle
 * @returns {never}
 */
function throwMenuNotFound(handle) {
  throw Object.assign(new Error('Menu not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    handle,
  });
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<object[]>}
 */
export async function listMenus() {
  const menus = await prisma.menu.findMany({
    orderBy: { handle: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  return menus.map((menu) => serializeMenu(menu));
}

/**
 * @param {string} handle
 * @param {{ locale?: string }} [options]
 */
export async function getMenuByHandle(handle, { locale = 'en' } = {}) {
  const menu = await prisma.menu.findUnique({
    where: { handle },
    include: { items: true },
  });
  if (!menu) return null;

  const items = await buildMenuTree(menu.items, locale);
  return { id: menu.id, handle: menu.handle, title: menu.title, items };
}

/**
 * Get a menu for admin/API with 404 on missing.
 *
 * @param {string} handle
 */
export async function getMenuOrThrow(handle) {
  const menu = await getMenuForAdmin(handle);
  if (!menu) throwMenuNotFound(handle);
  return menu;
}

/**
 * @param {string} handle
 * @param {{ title?: string, items?: object[] }} [options]
 */
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

/**
 * @param {string} handle
 */
export async function getMenuForAdmin(handle) {
  const menu = await prisma.menu.findUnique({
    where: { handle },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  return menu;
}

/**
 * Load admin menu editor data.
 *
 * @param {string} handle
 * @param {{ locale?: string }} [options]
 */
export async function loadMenuEditorData(handle, { locale = 'en' } = {}) {
  const [menus, menu, pages, categories] = await Promise.all([
    listMenus(),
    getMenuForAdmin(handle),
    prisma.page.findMany({
      where: { status: 'published' },
      orderBy: { position: 'asc' },
    }),
    prisma.category.findMany({ orderBy: { position: 'asc' } }),
  ]);

  const pageIds = pages.map((page) => page.id);
  const categoryIds = categories.map((category) => category.id);
  const [pageTitleMap, categoryTitleMap] = await Promise.all([
    loadPageTitleMap(pageIds, locale),
    loadCategoryTitleMap(categoryIds, locale),
  ]);

  return {
    handle,
    menus,
    menu,
    menuHandles: DEFAULT_MENU_HANDLES,
    pages: pages.map((page) => ({
      id: page.id,
      title: pageTitleMap.get(page.id) ?? page.id.slice(0, 8),
    })),
    categories: categories.map((category) => ({
      id: category.id,
      title: categoryTitleMap.get(category.id) ?? category.id.slice(0, 8),
    })),
  };
}
