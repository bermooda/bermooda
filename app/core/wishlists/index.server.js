// app/core/wishlists/index.server.js
// Customer wishlists.

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination.server';
import {
  loadProductSlugMap,
  loadProductTitleMap,
} from '#/core/catalog/translations.server';
import { getCustomer } from '#/core/customers/index.server';
import { resolveCatalogMediaUrl } from '#/core/storage/media';

export const DEFAULT_WISHLIST_LIST_LIMIT = 20;
export const MAX_WISHLIST_LIST_RESULTS = 100;

const WISHLIST_MUTATION_INTENTS = new Set(['add', 'remove']);

const WISHLIST_FORM_INTENT_MAP = {
  'add': 'add',
  'remove': 'remove',
  'wishlist-add': 'add',
  'wishlist-remove': 'remove',
};

const WISHLIST_ITEM_LIST_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      productId: true,
      product: {
        select: {
          id: true,
          media: {
            orderBy: { position: 'asc' },
            take: 1,
            include: { media: true },
          },
        },
      },
    },
  },
  wishlist: {
    select: {
      id: true,
      customerId: true,
      customer: { select: { id: true, name: true, email: true } },
    },
  },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse wishlist list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseWishlistListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_WISHLIST_LIST_LIMIT,
    max: MAX_WISHLIST_LIST_RESULTS,
  });

  const customerId = readQueryParam(source, 'customerId')?.trim();
  const variantId = readQueryParam(source, 'variantId')?.trim();
  const q = readQueryParam(source, 'q')?.trim();

  if (!customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  return {
    page,
    limit,
    customerId,
    ...(variantId ? { variantId } : {}),
    ...(q ? { q } : {}),
  };
}

/**
 * Parse admin wishlist index list query params (all customers).
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseWishlistAdminListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_WISHLIST_LIST_LIMIT,
    max: MAX_WISHLIST_LIST_RESULTS,
  });

  const customerId = readQueryParam(source, 'customerId')?.trim();
  const variantId = readQueryParam(source, 'variantId')?.trim();
  const q = readQueryParam(source, 'q')?.trim();

  return {
    page,
    limit,
    ...(customerId ? { customerId } : {}),
    ...(variantId ? { variantId } : {}),
    ...(q ? { q } : {}),
  };
}

/**
 * Build a Prisma where clause for wishlist item list filters.
 *
 * @param {{ customerId?: string, variantId?: string, q?: string }} filters
 */
export function buildWishlistItemWhere({ customerId, variantId, q } = {}) {
  const where = {};

  if (variantId) where.variantId = variantId;
  if (customerId) {
    where.wishlist = { customerId };
  }

  const query = q?.trim();
  if (query) {
    where.OR = [
      { variant: { sku: containsFilter(query) } },
      { wishlist: { customer: { email: containsFilter(query) } } },
    ];
  }

  return where;
}

function normalizeWishlistIntent(intent) {
  const normalized = WISHLIST_FORM_INTENT_MAP[intent?.toString().trim()];
  if (!normalized || !WISHLIST_MUTATION_INTENTS.has(normalized)) {
    throw Object.assign(new Error('Unknown wishlist action.'), {
      code: 'INVALID_WISHLIST_ACTION',
    });
  }
  return normalized;
}

/**
 * Parse wishlist mutation payload from storefront/API input.
 *
 * @param {object} input
 */
export function parseWishlistMutationInput(input = {}) {
  const customerId = input.customerId?.toString().trim();
  const variantId = input.variantId?.toString().trim();
  const intent = normalizeWishlistIntent(input.intent ?? 'add');

  if (!customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  if (!variantId) {
    throw Object.assign(new Error('variantId is required.'), {
      code: 'VARIANT_ID_REQUIRED',
    });
  }

  return { customerId, variantId, intent };
}

/**
 * Parse storefront wishlist form submission.
 *
 * @param {FormData} formData
 * @param {{ customerId?: string|null }} [context]
 */
export function parseWishlistFromForm(formData, { customerId = null } = {}) {
  return parseWishlistMutationInput({
    customerId,
    variantId: formData.get('variantId')?.toString(),
    intent: formData.get('intent')?.toString(),
  });
}

/**
 * Parse admin wishlist mutation JSON body.
 *
 * @param {object} body
 */
export function parseWishlistMutationFromJson(body = {}) {
  return parseWishlistMutationInput(body);
}

/**
 * Map wishlist mutation errors to storefront action payloads.
 *
 * @param {Error & { code?: string }} err
 * @param {{ style?: 'product'|'account' }} [opts]
 */
export function mapWishlistActionError(err, { style = 'product' } = {}) {
  const messageByCode = {
    VARIANT_ID_REQUIRED:
      style === 'account' ? 'Missing variant.' : 'Select a variant first.',
    NOT_FOUND:
      style === 'account' ? 'Variant not found.' : 'Variant not found.',
    INVALID_WISHLIST_ACTION:
      style === 'account'
        ? 'Unknown action.'
        : 'Could not update wishlist. Try again.',
  };

  const message =
    messageByCode[err.code] ??
    (style === 'account'
      ? (err.message ?? 'Could not update wishlist.')
      : 'Could not update wishlist. Try again.');

  if (style === 'account') {
    return { ok: false, error: message };
  }

  return { wishlistError: message };
}

/**
 * Parse admin delete-wishlist-item form intent.
 *
 * @param {FormData} formData
 */
export function parseDeleteWishlistItemFromForm(formData) {
  const id = formData.get('id')?.toString().trim();
  const intent = formData.get('intent')?.toString();

  if (intent !== 'delete') {
    throw Object.assign(new Error('Unknown wishlist action.'), {
      code: 'INVALID_WISHLIST_ACTION',
    });
  }

  if (!id) {
    throw Object.assign(new Error('Missing wishlist item id.'), {
      code: 'WISHLIST_ITEM_ID_REQUIRED',
    });
  }

  return { id };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a wishlist item for admin/API responses.
 *
 * @param {object} record
 * @param {{ productTitle?: string|null, productSlug?: string|null, imageUrl?: string|null }} [options]
 */
export function serializeWishlistItem(
  record,
  { productTitle, productSlug, imageUrl } = {}
) {
  const mediaEntry = record.variant?.product?.media?.[0];

  return {
    id: record.id,
    wishlistId: record.wishlistId,
    variantId: record.variantId,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    variantSku: record.variant?.sku ?? null,
    productId: record.variant?.productId ?? null,
    productTitle:
      productTitle ??
      record.productTitle ??
      record.variant?.productId?.slice?.(0, 8) ??
      null,
    productSlug: productSlug ?? record.productSlug ?? null,
    imageUrl:
      imageUrl ??
      record.imageUrl ??
      (mediaEntry ? resolveCatalogMediaUrl(mediaEntry, 640) : null),
    customerId: record.wishlist?.customerId ?? null,
    customer: record.wishlist?.customer
      ? {
          id: record.wishlist.customer.id,
          name: record.wishlist.customer.name ?? null,
          email: record.wishlist.customer.email ?? null,
        }
      : undefined,
  };
}

function throwWishlistItemNotFound(itemId) {
  throw Object.assign(new Error('Wishlist item not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    itemId,
  });
}

async function requireWishlistItemRecord(
  itemId,
  include = WISHLIST_ITEM_LIST_INCLUDE
) {
  const item = await prisma.wishlistItem.findUnique({
    where: { id: itemId },
    include,
  });
  if (!item) throwWishlistItemNotFound(itemId);
  return item;
}

async function serializeWishlistItemsWithProductTitles(items, locale = 'en') {
  const productIds = [
    ...new Set(items.map((item) => item.variant?.productId).filter(Boolean)),
  ];
  const [titleMap, slugMap] = await Promise.all([
    loadProductTitleMap(productIds, locale),
    loadProductSlugMap(productIds, locale),
  ]);

  return items.map((item) =>
    serializeWishlistItem(item, {
      productTitle:
        titleMap.get(item.variant?.productId) ??
        item.variant?.productId?.slice(0, 8) ??
        null,
      productSlug: slugMap.get(item.variant?.productId) ?? null,
    })
  );
}

// ---------------------------------------------------------------------------
// Queries and mutations
// ---------------------------------------------------------------------------

async function findDefaultWishlist(customerId) {
  return prisma.wishlist.findFirst({
    where: { customerId, isDefault: true },
    select: { id: true },
  });
}

async function getOrCreateDefaultWishlist(customerId) {
  const existing = await prisma.wishlist.findFirst({
    where: { customerId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.wishlist.create({
    data: {
      customerId,
      name: 'Default',
      isDefault: true,
    },
  });
}

async function requireCustomerRecord(customerId) {
  const customer = await getCustomer(customerId);
  if (!customer) {
    throw Object.assign(new Error('Customer not found.'), {
      code: 'NOT_FOUND',
      status: 404,
      customerId,
    });
  }
  return customer;
}

async function requireVariantRecord(variantId) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    throw Object.assign(new Error('Variant not found.'), {
      code: 'NOT_FOUND',
      status: 404,
      variantId,
    });
  }
  return variant;
}

/**
 * List wishlist items for a customer with optional filters and pagination.
 *
 * @param {{
 *   customerId: string,
 *   variantId?: string,
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   locale?: string,
 * }} options
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listWishlistItems(options) {
  const params =
    options.page != null ||
    options.limit != null ||
    options.variantId != null ||
    options.q != null ||
    options.customerId != null
      ? options
      : parseWishlistListParams(options);

  if (!params.customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_WISHLIST_LIST_LIMIT,
    maxLimit: MAX_WISHLIST_LIST_RESULTS,
  });
  const where = buildWishlistItemWhere(params);

  const [items, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: WISHLIST_ITEM_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  const serializedItems = await serializeWishlistItemsWithProductTitles(
    items,
    params.locale
  );

  return {
    items: serializedItems,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

/**
 * List wishlist items across customers for admin views.
 *
 * @param {{
 *   customerId?: string,
 *   variantId?: string,
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   locale?: string,
 * }} [options]
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listWishlistItemsAdmin(options = {}) {
  const params =
    options.page != null ||
    options.limit != null ||
    options.customerId != null ||
    options.variantId != null ||
    options.q != null
      ? options
      : parseWishlistAdminListParams(options);

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_WISHLIST_LIST_LIMIT,
    maxLimit: MAX_WISHLIST_LIST_RESULTS,
  });
  const where = buildWishlistItemWhere(params);

  const [items, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: WISHLIST_ITEM_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  const serializedItems = await serializeWishlistItemsWithProductTitles(
    items,
    params.locale
  );

  return {
    items: serializedItems,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

export async function getWishlistItem(itemId, locale = 'en') {
  const item = await requireWishlistItemRecord(itemId);
  const [serialized] = await serializeWishlistItemsWithProductTitles(
    [item],
    locale
  );
  return serialized;
}

export async function deleteWishlistItem(itemId) {
  await requireWishlistItemRecord(itemId, undefined);
  await prisma.wishlistItem.delete({ where: { id: itemId } });
  return { deleted: true };
}

export async function addToWishlist(
  customerId,
  variantId,
  { validateCustomer = false } = {}
) {
  if (validateCustomer) {
    await requireCustomerRecord(customerId);
  }
  await requireVariantRecord(variantId);

  const wishlist = await getOrCreateDefaultWishlist(customerId);
  return prisma.wishlistItem.upsert({
    where: {
      wishlistId_variantId: { wishlistId: wishlist.id, variantId },
    },
    create: { wishlistId: wishlist.id, variantId },
    update: {},
  });
}

export async function removeFromWishlist(customerId, variantId) {
  const wishlist = await findDefaultWishlist(customerId);
  if (!wishlist) {
    throw Object.assign(new Error('Wishlist item not found.'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const result = await prisma.wishlistItem.deleteMany({
    where: {
      wishlistId: wishlist.id,
      variantId,
    },
  });

  if (result.count === 0) {
    throw Object.assign(new Error('Wishlist item not found.'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return { deleted: true };
}

export async function getWishlistedVariantIds(customerId, productId) {
  const wishlist = await findDefaultWishlist(customerId);
  if (!wishlist) return [];

  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id, variant: { productId } },
    select: { variantId: true },
  });
  return items.map((item) => item.variantId);
}

/**
 * Load admin index data for wishlist items.
 *
 * @param {{ request: Request, pageSize?: number }} options
 */
export async function loadWishlistAdminIndexData({
  request,
  pageSize = DEFAULT_WISHLIST_LIST_LIMIT,
}) {
  const url = new URL(request.url);
  const params = parseWishlistAdminListParams({
    ...Object.fromEntries(url.searchParams.entries()),
    limit: String(pageSize),
  });

  return listWishlistItemsAdmin(params);
}
