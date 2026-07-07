// app/core/reviews/index.server.js
// Product reviews and ratings.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

export const DEFAULT_REVIEW_LIST_LIMIT = 20;
export const MAX_REVIEW_LIST_RESULTS = 100;

const REVIEW_STATUS_SET = new Set(REVIEW_STATUSES);
const PURCHASE_STATUSES = new Set(['paid', 'fulfilled']);

const REVIEW_LIST_INCLUDE = {
  product: { select: { id: true } },
  customer: { select: { id: true, name: true, email: true } },
};

const REVIEW_DETAIL_INCLUDE = {
  product: { select: { id: true } },
  customer: { select: { id: true, name: true, email: true } },
};

const REVIEW_PUBLIC_INCLUDE = {
  customer: { select: { id: true, name: true } },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse review list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseReviewListParams(source = {}) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    Math.max(
      1,
      parseInt(get('limit') ?? String(DEFAULT_REVIEW_LIST_LIMIT), 10) ||
        DEFAULT_REVIEW_LIST_LIMIT
    ),
    MAX_REVIEW_LIST_RESULTS
  );

  const productId = get('productId')?.trim();
  const customerId = get('customerId')?.trim();
  const status = get('status')?.trim();

  if (status && status !== 'all' && !REVIEW_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid review status filter.'), {
      code: 'INVALID_REVIEW_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(productId ? { productId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
  };
}

/**
 * Build a Prisma where clause for review list filters.
 *
 * @param {{ productId?: string, customerId?: string, status?: string }} filters
 */
export function buildReviewWhere({ productId, customerId, status } = {}) {
  const where = {};
  if (productId) where.productId = productId;
  if (customerId) where.customerId = customerId;
  if (status && status !== 'all') where.status = status;
  return where;
}

/**
 * Parse create-review payload from admin/API/storefront input.
 *
 * @param {object} input
 */
export function parseCreateReviewInput(input = {}) {
  const productId = input.productId?.toString().trim();
  const customerId = input.customerId?.toString().trim();
  const title = input.title?.toString().trim() || undefined;
  const body = input.body?.toString().trim();

  const numericRating =
    typeof input.rating === 'number'
      ? input.rating
      : parseInt(String(input.rating ?? ''), 10);

  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    throw Object.assign(new Error('Rating must be between 1 and 5.'), {
      code: 'RATING_INVALID',
    });
  }

  if (!body) {
    throw Object.assign(new Error('Review body is required.'), {
      code: 'BODY_REQUIRED',
    });
  }

  if (!productId) {
    throw Object.assign(new Error('productId is required.'), {
      code: 'PRODUCT_ID_REQUIRED',
    });
  }

  if (!customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  return {
    productId,
    customerId,
    rating: numericRating,
    title,
    body,
  };
}

/**
 * Resolve the HTTP status for a review domain error.
 *
 * @param {Error & { code?: string }} err
 * @returns {number}
 */
export function resolveReviewErrorStatus(err) {
  if (err.code === 'CUSTOMER_ID_REQUIRED') return 400;
  if (err.code === 'INVALID_REVIEW_STATUS') return 400;
  return 422;
}

/**
 * Parse moderate-review payload from admin/API input.
 *
 * @param {object} input
 */
export function parseModerateReviewInput(input = {}) {
  const status = input.status?.toString().trim();
  if (!status || !REVIEW_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid review status.'), {
      code: 'INVALID_REVIEW_STATUS',
    });
  }
  return { status };
}

/**
 * Parse admin form moderation intent.
 *
 * @param {FormData} formData
 */
export function parseReviewModerationFromForm(formData) {
  const id = formData.get('id')?.toString().trim();
  const intent = formData.get('intent')?.toString();

  if (!id) {
    throw Object.assign(new Error('Missing review id.'), {
      code: 'REVIEW_ID_REQUIRED',
    });
  }

  if (intent === 'approve') {
    return { id, status: 'approved' };
  }
  if (intent === 'reject') {
    return { id, status: 'rejected' };
  }
  if (intent === 'delete') {
    return { id, delete: true };
  }

  throw Object.assign(new Error('Unknown review action.'), {
    code: 'INVALID_REVIEW_ACTION',
  });
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Format aggregate review summary values.
 *
 * @param {number|null|undefined} average
 * @param {number} count
 */
export function formatReviewSummary(average, count) {
  return {
    averageRating: average ? Math.round(average * 10) / 10 : 0,
    count,
  };
}

/**
 * Serialize a review for admin/API responses.
 *
 * @param {object} record
 * @param {{ productTitle?: string|null }} [options]
 */
export function serializeReview(record, { productTitle } = {}) {
  return {
    id: record.id,
    productId: record.productId,
    customerId: record.customerId,
    rating: record.rating,
    title: record.title ?? null,
    body: record.body,
    status: record.status,
    verifiedPurchase: record.verifiedPurchase ?? false,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    productTitle:
      productTitle ??
      record.productTitle ??
      record.productId?.slice?.(0, 8) ??
      null,
    customer: record.customer
      ? {
          id: record.customer.id,
          name: record.customer.name ?? null,
          email: record.customer.email ?? null,
        }
      : undefined,
    customerName:
      record.customer?.name ||
      record.customer?.email ||
      record.customerName ||
      null,
  };
}

/**
 * Serialize a review for storefront/public API responses.
 *
 * @param {object} record
 */
export function serializePublicReview(record) {
  return {
    id: record.id,
    productId: record.productId,
    rating: record.rating,
    title: record.title ?? null,
    body: record.body,
    status: record.status,
    verifiedPurchase: record.verifiedPurchase ?? false,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    customer: record.customer
      ? {
          id: record.customer.id,
          name: record.customer.name ?? null,
        }
      : undefined,
  };
}

function throwReviewNotFound(reviewId) {
  throw Object.assign(new Error('Review not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    reviewId,
  });
}

async function requireReviewRecord(reviewId, include = REVIEW_DETAIL_INCLUDE) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include,
  });
  if (!review) throwReviewNotFound(reviewId);
  return review;
}

async function serializeReviewsWithProductTitles(reviews, locale = 'en') {
  const productIds = [...new Set(reviews.map((review) => review.productId))];
  const titleMap = await loadProductTitleMap(productIds, locale);

  return reviews.map((review) =>
    serializeReview(review, {
      productTitle:
        titleMap.get(review.productId) ?? review.productId.slice(0, 8),
    })
  );
}

// ---------------------------------------------------------------------------
// Queries and mutations
// ---------------------------------------------------------------------------

export async function hasVerifiedPurchase(customerId, productId) {
  const order = await prisma.order.findFirst({
    where: {
      customerId,
      status: { in: [...PURCHASE_STATUSES] },
      lines: {
        some: {
          variant: { productId },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(order);
}

/**
 * List reviews with optional filters and pagination.
 *
 * @param {{
 *   productId?: string,
 *   customerId?: string,
 *   status?: string,
 *   page?: number,
 *   limit?: number,
 *   locale?: string,
 *   public?: boolean,
 * }} options
 */
export async function listReviews(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parseReviewListParams(options);

  const safePage = Math.max(1, params.page ?? 1);
  const safeLimit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_REVIEW_LIST_LIMIT),
    MAX_REVIEW_LIST_RESULTS
  );
  const skip = (safePage - 1) * safeLimit;
  const where = buildReviewWhere(params);
  const include = options.public ? REVIEW_PUBLIC_INCLUDE : REVIEW_LIST_INCLUDE;

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.review.count({ where }),
  ]);

  const reviews = options.public
    ? items.map(serializePublicReview)
    : await serializeReviewsWithProductTitles(items, options.locale ?? 'en');

  return {
    reviews,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * List approved reviews for a product (storefront/public API).
 *
 * @param {string} productId
 * @param {{ page?: number, limit?: number }} [options]
 */
export async function listReviewsForProduct(
  productId,
  { page = 1, limit = 10 } = {}
) {
  return listReviews({
    productId,
    status: 'approved',
    page,
    limit,
    public: true,
  });
}

export async function getReviewSummary(productId) {
  const result = await prisma.review.aggregate({
    where: { productId, status: 'approved' },
    _avg: { rating: true },
    _count: { id: true },
  });

  return formatReviewSummary(result._avg.rating, result._count.id);
}

export async function attachReviewSummaries(products) {
  if (!products?.length) return products;

  const ids = products.map((product) => product.id);
  const rows = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: ids }, status: 'approved' },
    _avg: { rating: true },
    _count: { id: true },
  });

  const summaryMap = Object.fromEntries(
    rows.map((row) => [
      row.productId,
      formatReviewSummary(row._avg.rating, row._count.id),
    ])
  );

  return products.map((product) => ({
    ...product,
    reviewSummary: summaryMap[product.id] ?? formatReviewSummary(null, 0),
  }));
}

export async function createReview(input) {
  const { productId, customerId, rating, title, body } =
    parseCreateReviewInput(input);

  const existing = await prisma.review.findUnique({
    where: { productId_customerId: { productId, customerId } },
  });
  if (existing) {
    throw Object.assign(new Error('You have already reviewed this product.'), {
      code: 'DUPLICATE_REVIEW',
    });
  }

  const verifiedPurchase = await hasVerifiedPurchase(customerId, productId);

  const review = await prisma.review.create({
    data: {
      productId,
      customerId,
      rating,
      title: title ?? null,
      body,
      status: 'pending',
      verifiedPurchase,
    },
    include: REVIEW_DETAIL_INCLUDE,
  });

  logger.info({ reviewId: review.id, productId }, 'review submitted');
  return serializeReview(review);
}

export async function getReview(reviewId, { locale = 'en' } = {}) {
  const review = await requireReviewRecord(reviewId);
  const [serialized] = await serializeReviewsWithProductTitles(
    [review],
    locale
  );
  return serialized;
}

export async function moderateReview(id, input) {
  await requireReviewRecord(id);
  const { status } = parseModerateReviewInput(input);

  const updated = await prisma.review.update({
    where: { id },
    data: { status },
    include: REVIEW_DETAIL_INCLUDE,
  });

  const [serialized] = await serializeReviewsWithProductTitles([updated]);
  return serialized;
}

export async function deleteReview(id) {
  await requireReviewRecord(id);
  await prisma.review.delete({ where: { id } });
}

export async function countPendingReviews() {
  return prisma.review.count({ where: { status: 'pending' } });
}
