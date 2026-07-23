// app/core/back-in-stock/index.server.js
// Back-in-stock subscriptions and notifications.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters/index.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination/index.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { sendBackInStockEmail } from '#/emails/index.server';

export const SUBSCRIPTION_STATUSES = ['pending', 'notified', 'all'];

export const DEFAULT_SUBSCRIPTION_LIST_LIMIT = 20;
export const MAX_SUBSCRIPTION_LIST_RESULTS = 100;

const SUBSCRIPTION_STATUS_SET = new Set(SUBSCRIPTION_STATUSES);

const SUBSCRIPTION_LIST_INCLUDE = {
  variant: {
    select: { id: true, sku: true, productId: true },
  },
  customer: { select: { id: true, name: true, email: true } },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Normalize a subscriber email for lookup and storage.
 *
 * @param {string} email
 * @returns {string}
 */
export function normalizeSubscriberEmail(email) {
  return email?.toString().trim().toLowerCase() ?? '';
}

/**
 * Parse back-in-stock subscription list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseSubscriptionListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_SUBSCRIPTION_LIST_LIMIT,
    max: MAX_SUBSCRIPTION_LIST_RESULTS,
  });

  const variantId = readQueryParam(source, 'variantId')?.trim();
  const customerId = readQueryParam(source, 'customerId')?.trim();
  const status = readQueryParam(source, 'status')?.trim() || 'pending';
  const q = readQueryParam(source, 'q')?.trim();

  if (!SUBSCRIPTION_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid subscription status filter.'), {
      code: 'INVALID_SUBSCRIPTION_STATUS',
    });
  }

  return {
    page,
    limit,
    status,
    ...(variantId ? { variantId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(q ? { q } : {}),
  };
}

/**
 * Build a Prisma where clause for subscription list filters.
 *
 * @param {{ variantId?: string, customerId?: string, status?: string, q?: string }} filters
 */
export function buildSubscriptionWhere({
  variantId,
  customerId,
  status = 'pending',
  q,
} = {}) {
  const where = {};

  if (variantId) where.variantId = variantId;
  if (customerId) where.customerId = customerId;

  if (status === 'pending') {
    where.notifiedAt = null;
  } else if (status === 'notified') {
    where.notifiedAt = { not: null };
  }

  const query = q?.trim();
  if (query) {
    where.email = containsFilter(normalizeSubscriberEmail(query));
  }

  return where;
}

/**
 * Parse subscribe payload from storefront/API input.
 *
 * @param {object} input
 */
export function parseSubscribeInput(input = {}) {
  const variantId = input.variantId?.toString().trim();
  const email = normalizeSubscriberEmail(input.email);
  const customerId = input.customerId?.toString().trim() || null;

  if (!variantId) {
    throw Object.assign(new Error('variantId is required.'), {
      code: 'VARIANT_ID_REQUIRED',
    });
  }

  if (!email) {
    throw Object.assign(new Error('Email is required.'), {
      code: 'EMAIL_REQUIRED',
    });
  }

  return { variantId, email, customerId };
}

/**
 * Parse storefront back-in-stock form submission.
 *
 * @param {FormData} formData
 * @param {{ customerId?: string|null }} [context]
 */
export function parseSubscribeFromForm(formData, { customerId = null } = {}) {
  return parseSubscribeInput({
    variantId: formData.get('variantId')?.toString(),
    email: formData.get('email')?.toString() ?? '',
    customerId,
  });
}

/**
 * Parse admin delete-subscription form intent.
 *
 * @param {FormData} formData
 */
export function parseDeleteSubscriptionFromForm(formData) {
  const id = formData.get('id')?.toString().trim();
  const intent = formData.get('intent')?.toString();

  if (intent !== 'delete') {
    throw Object.assign(new Error('Unknown subscription action.'), {
      code: 'INVALID_SUBSCRIPTION_ACTION',
    });
  }

  if (!id) {
    throw Object.assign(new Error('Missing subscription id.'), {
      code: 'SUBSCRIPTION_ID_REQUIRED',
    });
  }

  return { id };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a back-in-stock subscription for admin/API responses.
 *
 * @param {object} record
 * @param {{ productTitle?: string|null }} [options]
 */
export function serializeBackInStockSubscription(
  record,
  { productTitle } = {}
) {
  return {
    id: record.id,
    variantId: record.variantId,
    customerId: record.customerId ?? null,
    email: record.email,
    notifiedAt: record.notifiedAt?.toISOString?.() ?? record.notifiedAt ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    variantSku: record.variant?.sku ?? null,
    productId: record.variant?.productId ?? null,
    productTitle:
      productTitle ??
      record.productTitle ??
      record.variant?.productId?.slice?.(0, 8) ??
      null,
    customer: record.customer
      ? {
          id: record.customer.id,
          name: record.customer.name ?? null,
          email: record.customer.email ?? null,
        }
      : undefined,
  };
}

function throwSubscriptionNotFound(subscriptionId) {
  throw Object.assign(new Error('Back-in-stock subscription not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    subscriptionId,
  });
}

async function requireSubscriptionRecord(
  subscriptionId,
  include = SUBSCRIPTION_LIST_INCLUDE
) {
  const subscription = await prisma.backInStockSubscription.findUnique({
    where: { id: subscriptionId },
    include,
  });
  if (!subscription) throwSubscriptionNotFound(subscriptionId);
  return subscription;
}

async function serializeSubscriptionsWithProductTitles(
  subscriptions,
  locale = 'en'
) {
  const productIds = [
    ...new Set(
      subscriptions
        .map((subscription) => subscription.variant?.productId)
        .filter(Boolean)
    ),
  ];
  const titleMap = await loadProductTitleMap(productIds, locale);

  return subscriptions.map((subscription) =>
    serializeBackInStockSubscription(subscription, {
      productTitle:
        titleMap.get(subscription.variant?.productId) ??
        subscription.variant?.productId?.slice(0, 8) ??
        null,
    })
  );
}

// ---------------------------------------------------------------------------
// Queries and mutations
// ---------------------------------------------------------------------------

export async function subscribeBackInStock(input) {
  const { variantId, email, customerId } = parseSubscribeInput(input);

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    throw Object.assign(new Error('Variant not found.'), {
      code: 'NOT_FOUND',
    });
  }

  return prisma.backInStockSubscription.upsert({
    where: {
      variantId_email: { variantId, email },
    },
    create: {
      variantId,
      email,
      customerId,
      notifiedAt: null,
    },
    update: {
      customerId,
      notifiedAt: null,
    },
  });
}

async function listPendingSubscriptionsForVariant(variantId) {
  return prisma.backInStockSubscription.findMany({
    where: { variantId, notifiedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * List back-in-stock subscriptions with optional filters and pagination.
 *
 * @param {{
 *   variantId?: string,
 *   customerId?: string,
 *   status?: string,
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   locale?: string,
 * }} [options]
 */
export async function listBackInStockSubscriptions(options = {}) {
  const params =
    options.page != null ||
    options.limit != null ||
    options.variantId != null ||
    options.customerId != null ||
    options.status != null ||
    options.q != null
      ? options
      : parseSubscriptionListParams(options);

  const { page, limit, skip, take } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_SUBSCRIPTION_LIST_LIMIT,
    maxLimit: MAX_SUBSCRIPTION_LIST_RESULTS,
  });
  const where = buildSubscriptionWhere(params);

  const [items, total] = await Promise.all([
    prisma.backInStockSubscription.findMany({
      where,
      include: SUBSCRIPTION_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.backInStockSubscription.count({ where }),
  ]);

  const subscriptions = await serializeSubscriptionsWithProductTitles(
    items,
    params.locale
  );

  return {
    subscriptions,
    ...buildPaginationMeta({ page, limit, total }),
  };
}

export async function getBackInStockSubscription(
  subscriptionId,
  locale = 'en'
) {
  const subscription = await requireSubscriptionRecord(subscriptionId);
  const [serialized] = await serializeSubscriptionsWithProductTitles(
    [subscription],
    locale
  );
  return serialized;
}

export async function deleteBackInStockSubscription(subscriptionId) {
  await requireSubscriptionRecord(subscriptionId, undefined);
  await prisma.backInStockSubscription.delete({
    where: { id: subscriptionId },
  });
  return { deleted: true };
}

/**
 * Load admin index data for back-in-stock subscriptions.
 *
 * @param {{ request: Request, pageSize?: number }} options
 */
export async function loadBackInStockAdminIndexData({
  request,
  pageSize = DEFAULT_SUBSCRIPTION_LIST_LIMIT,
}) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const params = parseSubscriptionListParams({
    ...Object.fromEntries(url.searchParams.entries()),
    status,
    limit: String(pageSize),
  });

  return listBackInStockSubscriptions(params);
}

/**
 * Notify subscribers when a variant is back in stock.
 */
export async function notifyBackInStockSubscribers(variantId) {
  const subscriptions = await listPendingSubscriptionsForVariant(variantId);
  if (!subscriptions.length) return { notified: 0 };

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant) return { notified: 0 };

  let notified = 0;
  for (const sub of subscriptions) {
    try {
      await sendBackInStockEmail({
        to: sub.email,
        variant,
      });
      await prisma.backInStockSubscription.update({
        where: { id: sub.id },
        data: { notifiedAt: new Date() },
      });
      notified += 1;
    } catch (err) {
      logger.error(
        { err, subscriptionId: sub.id, variantId },
        'Back-in-stock notification failed'
      );
    }
  }

  return { notified };
}

/**
 * Register inventory.restocked subscriber.
 * @param {{ on: Function }} bus
 */
export function registerBackInStockSubscribers({ on }) {
  on('inventory.restocked', async ({ variantId }) => {
    await notifyBackInStockSubscribers(variantId);
  });
}
