// app/core/reviews/index.server.js
// Product reviews and ratings.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected']);
const PURCHASE_STATUSES = new Set(['paid', 'fulfilled']);

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

export async function listReviewsForProduct(
  productId,
  { status = 'approved', page = 1, limit = 10 } = {}
) {
  const where = { productId };
  if (status) where.status = status;

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total };
}

export async function getReviewSummary(productId) {
  const result = await prisma.review.aggregate({
    where: { productId, status: 'approved' },
    _avg: { rating: true },
    _count: { id: true },
  });

  return {
    averageRating: result._avg.rating
      ? Math.round(result._avg.rating * 10) / 10
      : 0,
    count: result._count.id,
  };
}

export async function attachReviewSummaries(products) {
  if (!products?.length) return products;

  const ids = products.map((p) => p.id);
  const rows = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: ids }, status: 'approved' },
    _avg: { rating: true },
    _count: { id: true },
  });

  const summaryMap = Object.fromEntries(
    rows.map((row) => [
      row.productId,
      {
        averageRating: row._avg.rating
          ? Math.round(row._avg.rating * 10) / 10
          : 0,
        count: row._count.id,
      },
    ])
  );

  return products.map((product) => ({
    ...product,
    reviewSummary: summaryMap[product.id] ?? { averageRating: 0, count: 0 },
  }));
}

export async function createReview({
  productId,
  customerId,
  rating,
  title,
  body,
}) {
  const numericRating = Number(rating);
  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    throw new Error('Rating must be between 1 and 5');
  }
  if (!body?.trim()) {
    throw new Error('Review body is required');
  }

  const existing = await prisma.review.findUnique({
    where: { productId_customerId: { productId, customerId } },
  });
  if (existing) {
    throw new Error('You have already reviewed this product');
  }

  const verifiedPurchase = await hasVerifiedPurchase(customerId, productId);

  const review = await prisma.review.create({
    data: {
      productId,
      customerId,
      rating: numericRating,
      title: title?.trim() || null,
      body: body.trim(),
      status: 'pending',
      verifiedPurchase,
    },
  });

  logger.info({ reviewId: review.id, productId }, 'review submitted');
  return review;
}

export async function moderateReview(id, { status }) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error('Invalid review status');
  }

  return prisma.review.update({
    where: { id },
    data: { status },
  });
}

export async function deleteReview(id) {
  await prisma.review.delete({ where: { id } });
}

export async function listReviewsForAdmin({
  status,
  page = 1,
  limit = 20,
} = {}) {
  const where = {};
  if (status && status !== 'all') where.status = status;

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total };
}

export async function countPendingReviews() {
  return prisma.review.count({ where: { status: 'pending' } });
}
