// app/core/content/index.server.js
// CMS pages and navigation menus.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination.server';
import {
  getTranslations,
  resolveSlug,
  setSlug,
  setTranslation,
} from '#/core/catalog/index.server';
import {
  loadCategoryTitleMap,
  loadPageTitleMap,
  withTranslations,
} from '#/core/catalog/translations.server';
import { getAvailableLocales } from '#/core/i18n/index.server';

export const PAGE_STATUSES = ['draft', 'published'];
export const DEFAULT_MENU_HANDLES = ['main', 'footer', 'sub-header'];
export const DEFAULT_PAGE_LIST_LIMIT = 20;
export const MAX_PAGE_LIST_RESULTS = 100;
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

const PAGE_STATUS_SET = new Set(PAGE_STATUSES);
const PAGE_FIELDS = ['title', 'body', 'metaTitle', 'metaDescription'];

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse page list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ page: number, limit: number, status?: string, q?: string }}
 */
export function parsePageListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_PAGE_LIST_LIMIT,
    max: MAX_PAGE_LIST_RESULTS,
  });
  const status = readQueryParam(source, 'status')?.trim();
  const q = readQueryParam(source, 'q')?.trim();

  if (status && status !== 'all' && !PAGE_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid page status filter.'), {
      code: 'INVALID_PAGE_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  };
}

/**
 * Build a Prisma where clause for page list filters.
 *
 * @param {{ status?: string, q?: string }} filters
 * @returns {Promise<object>}
 */
export async function buildPageSearchWhere({ status, q } = {}) {
  const where = {};

  if (status && status !== 'all') {
    where.status = status;
  }

  const query = q?.trim();
  if (query) {
    const slugRows = await prisma.slug.findMany({
      where: {
        entityType: 'page',
        slug: containsFilter(query),
      },
      select: { entityId: true },
    });
    const pageIds = slugRows.map((row) => row.entityId);
    where.id = { in: pageIds };
  }

  return where;
}

/**
 * Validate a CMS page slug.
 *
 * @param {string} slug
 */
export function validatePageSlug(slug) {
  const normalized = slug?.toString().trim();
  if (!normalized) {
    throw Object.assign(new Error('Slug is required.'), {
      code: 'SLUG_REQUIRED',
    });
  }
  if (!PAGE_SLUG_PATTERN.test(normalized)) {
    throw Object.assign(
      new Error('Slug must be lowercase letters, numbers and hyphens only.'),
      { code: 'SLUG_INVALID' }
    );
  }
  if (isReservedPageSlug(normalized)) {
    throw Object.assign(new Error('Slug is reserved.'), {
      code: 'SLUG_RESERVED',
    });
  }
  return normalized;
}

/**
 * Parse create-page payload from admin/API input.
 *
 * @param {object} input
 */
export function parseCreatePageInput(input = {}) {
  const locale = input.locale?.toString().trim() || 'en';
  const type = input.type?.toString().trim() || 'page';
  const status = input.status?.toString().trim() || 'draft';

  if (!PAGE_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid page status.'), {
      code: 'INVALID_PAGE_STATUS',
    });
  }

  const slug =
    input.slug !== undefined && input.slug !== null && input.slug !== ''
      ? validatePageSlug(input.slug)
      : undefined;

  const translations = {};
  for (const field of PAGE_FIELDS) {
    if (input[field] !== undefined) {
      translations[field] = input[field]?.toString() ?? '';
    } else if (input.translations?.[field] !== undefined) {
      translations[field] = input.translations[field]?.toString() ?? '';
    }
  }

  if (slug && !translations.title?.trim()) {
    throw Object.assign(new Error('Title is required.'), {
      code: 'TITLE_REQUIRED',
    });
  }

  return { translations, slug, locale, type, status };
}

/**
 * Parse update-page payload from admin/API input.
 *
 * @param {object} input
 */
export function parseUpdatePageInput(input = {}) {
  const parsed = {};

  if (input.locale !== undefined) {
    parsed.locale = input.locale?.toString().trim() || 'en';
  }
  if (input.type !== undefined) {
    parsed.type = input.type?.toString().trim();
  }
  if (input.status !== undefined) {
    const status = input.status?.toString().trim();
    if (!PAGE_STATUS_SET.has(status)) {
      throw Object.assign(new Error('Invalid page status.'), {
        code: 'INVALID_PAGE_STATUS',
      });
    }
    parsed.status = status;
  }
  if (input.slug !== undefined) {
    parsed.slug =
      input.slug === null || input.slug === ''
        ? null
        : validatePageSlug(input.slug);
  }

  const translations = {};
  for (const field of PAGE_FIELDS) {
    if (input[field] !== undefined) {
      translations[field] = input[field]?.toString() ?? '';
    } else if (input.translations?.[field] !== undefined) {
      translations[field] = input.translations[field]?.toString() ?? '';
    }
  }
  if (Object.keys(translations).length > 0) {
    parsed.translations = translations;
  }

  return parsed;
}

/**
 * Parse admin page editor form data.
 *
 * @param {FormData} formData
 */
export function parsePageFormInput(formData) {
  const intent = formData.get('intent')?.toString();
  if (intent === 'delete') {
    return { intent: 'delete' };
  }

  return parseUpdatePageInput({
    locale: formData.get('locale')?.toString() ?? 'en',
    status: formData.get('status')?.toString() ?? 'draft',
    slug: formData.get('slug')?.toString().trim(),
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
    metaTitle: formData.get('metaTitle')?.toString() ?? '',
    metaDescription: formData.get('metaDescription')?.toString() ?? '',
  });
}

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
 * Serialize a page for admin list/API responses.
 *
 * @param {object} record
 * @param {{ title?: string|null, slug?: string|null }} [options]
 */
export function serializePageListItem(record, { title, slug } = {}) {
  return {
    id: record.id,
    title: title ?? null,
    slug: slug ?? null,
    status: record.status,
    type: record.type,
    publishedAt:
      record.publishedAt?.toISOString?.() ?? record.publishedAt ?? null,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
  };
}

/**
 * Serialize a page for admin editor/API detail responses.
 *
 * @param {object} record
 * @param {{
 *   translationMap?: Record<string, Record<string, string>>,
 *   slugMap?: Record<string, string>,
 * }} [options]
 */
export function serializePageDetail(
  record,
  { translationMap = {}, slugMap = {} } = {}
) {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    publishedAt:
      record.publishedAt?.toISOString?.() ?? record.publishedAt ?? null,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    translationMap,
    slugMap,
  };
}

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

async function loadPageSlugMap(pageIds, locale = 'en') {
  const uniqueIds = [...new Set(pageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await prisma.slug.findMany({
    where: {
      entityType: 'page',
      entityId: { in: uniqueIds },
      locale,
    },
    select: { entityId: true, slug: true },
  });

  return new Map(rows.map((row) => [row.entityId, row.slug]));
}

function throwPageNotFound(pageId) {
  throw Object.assign(new Error('Page not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    pageId,
  });
}

function throwMenuNotFound(handle) {
  throw Object.assign(new Error('Menu not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    handle,
  });
}

async function requirePageRecord(pageId) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) throwPageNotFound(pageId);
  return page;
}

async function serializePagesWithTitles(pages, locale = 'en') {
  const pageIds = pages.map((page) => page.id);
  const [titleMap, slugMap] = await Promise.all([
    loadPageTitleMap(pageIds, locale),
    loadPageSlugMap(pageIds, locale),
  ]);

  return pages.map((page) =>
    serializePageListItem(page, {
      title: titleMap.get(page.id) ?? null,
      slug: slugMap.get(page.id) ?? null,
    })
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function isReservedPageSlug(slug) {
  return RESERVED_PAGE_SLUGS.has(slug);
}

/**
 * List pages with optional filters and pagination.
 *
 * @param {{
 *   status?: string,
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   locale?: string,
 * }} [options]
 * @returns {Promise<{ pages: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listPages(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parsePageListParams(options);

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_PAGE_LIST_LIMIT,
    maxLimit: MAX_PAGE_LIST_RESULTS,
  });
  const where = await buildPageSearchWhere(params);
  const locale = params.locale ?? 'en';

  const [rows, total] = await Promise.all([
    prisma.page.findMany({
      where,
      skip,
      take,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.page.count({ where }),
  ]);

  const pages = await serializePagesWithTitles(rows, locale);
  return {
    pages,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

/**
 * Admin pages index payload with status counts.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {Promise<{ pages: object[], total: number, publishedCount: number, draftCount: number, page: number, pageSize: number, totalPages: number, status: string, q: string }>}
 */
export async function listPagesAdmin(source = {}) {
  const params = parsePageListParams(source);
  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_PAGE_LIST_LIMIT,
    maxLimit: MAX_PAGE_LIST_RESULTS,
  });
  const where = await buildPageSearchWhere(params);

  const [total, publishedCount, draftCount, rows] = await Promise.all([
    prisma.page.count({ where }),
    prisma.page.count({ where: { ...where, status: 'published' } }),
    prisma.page.count({ where: { ...where, status: 'draft' } }),
    prisma.page.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ]);

  const pages = await serializePagesWithTitles(rows);
  const pagination = buildPaginationMeta({
    page: safePage,
    limit: safeLimit,
    total,
  });

  return {
    pages,
    total: pagination.total,
    publishedCount,
    draftCount,
    page: pagination.page,
    pageSize: pagination.limit,
    totalPages: pagination.totalPages,
    status: params.status ?? 'all',
    q: params.q ?? '',
  };
}

export async function getPage(id, { locale } = {}) {
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) return null;
  if (!locale) return page;
  return attachPageLocale(page, locale);
}

/**
 * Load admin page editor data.
 *
 * @param {string} id
 */
export async function loadPageEditorData(id) {
  const page = await requirePageRecord(id);
  const locales = await getAvailableLocales();
  if (!locales.includes('en')) locales.unshift('en');

  const [translations, slugRows] = await Promise.all([
    prisma.translation.findMany({
      where: { entityType: 'page', entityId: id },
    }),
    prisma.slug.findMany({
      where: { entityType: 'page', entityId: id },
    }),
  ]);

  const translationMap = {};
  for (const row of translations) {
    if (!translationMap[row.locale]) translationMap[row.locale] = {};
    translationMap[row.locale][row.field] = row.value;
  }

  const slugMap = Object.fromEntries(
    slugRows.map((row) => [row.locale, row.slug])
  );

  return {
    page: serializePageDetail(page, { translationMap, slugMap }),
    locales,
    translationMap,
    slugMap,
  };
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

export async function createPage(input = {}) {
  const { translations, slug, locale, type, status } =
    parseCreatePageInput(input);

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

export async function updatePage(id, input = {}) {
  const existing = await requirePageRecord(id);
  const {
    translations,
    slug,
    locale = 'en',
    type,
    status,
  } = parseUpdatePageInput(input);

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
  await requirePageRecord(id);
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

  if (pages.length === 0) return [];

  const slugMap = await loadPageSlugMap(
    pages.map((page) => page.id),
    locale
  );

  return pages.map((page) => ({
    ...page,
    slug: slugMap.get(page.id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

async function resolveMenuItemLabel(item, locale) {
  const translations = await getTranslations('menu_item', item.id, locale);
  return translations.label || item.label;
}

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
  return menus.map((menu) => serializeMenu(menu));
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
