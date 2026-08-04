// app/core/content/index.server.js
// Barrel re-exports for the content domain (backward-compatible public API).

export {
  PAGE_STATUSES,
  DEFAULT_PAGE_LIST_LIMIT,
  MAX_PAGE_LIST_RESULTS,
  PAGE_SLUG_PATTERN,
  RESERVED_PAGE_SLUGS,
  parsePageListParams,
  buildPageSearchWhere,
  validatePageSlug,
  parseCreatePageInput,
  parseUpdatePageInput,
  parsePageFormInput,
  serializePageListItem,
  serializePageDetail,
  isReservedPageSlug,
  listPages,
  listPagesAdmin,
  getPage,
  loadPageEditorData,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
  listPublishedPages,
} from '#/core/content/pages.server';

export {
  DEFAULT_MENU_HANDLES,
  parseMenuFormInput,
  serializeMenu,
  listMenus,
  getMenuByHandle,
  getMenuOrThrow,
  upsertMenu,
  getMenuForAdmin,
  loadMenuEditorData,
} from '#/core/content/menus.server';
