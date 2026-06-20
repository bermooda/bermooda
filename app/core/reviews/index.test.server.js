// app/core/reviews/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    review: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    order: { findFirst: vi.fn() },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';

import {
  createReview,
  getReviewSummary,
  hasVerifiedPurchase,
  moderateReview,
} from '#/core/reviews/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasVerifiedPurchase', () => {
  it('returns true when paid order contains product', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order_1' });
    expect(await hasVerifiedPurchase('cust_1', 'prod_1')).toBe(true);
  });

  it('returns false when no qualifying order', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    expect(await hasVerifiedPurchase('cust_1', 'prod_1')).toBe(false);
  });
});

describe('getReviewSummary', () => {
  it('returns average and count from approved reviews', async () => {
    prisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { id: 2 },
    });

    const summary = await getReviewSummary('prod_1');
    expect(summary).toEqual({ averageRating: 4.5, count: 2 });
  });
});

describe('createReview', () => {
  it('rejects duplicate reviews', async () => {
    prisma.review.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      createReview({
        productId: 'prod_1',
        customerId: 'cust_1',
        rating: 5,
        body: 'Great',
      })
    ).rejects.toThrow('already reviewed');
  });

  it('creates pending review with verified flag', async () => {
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.order.findFirst.mockResolvedValue({ id: 'order_1' });
    prisma.review.create.mockResolvedValue({ id: 'rev_1', status: 'pending' });

    await createReview({
      productId: 'prod_1',
      customerId: 'cust_1',
      rating: 5,
      body: 'Love it',
    });

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          verifiedPurchase: true,
          rating: 5,
        }),
      })
    );
  });
});

describe('moderateReview', () => {
  it('updates review status', async () => {
    prisma.review.update.mockResolvedValue({ id: 'rev_1', status: 'approved' });
    await moderateReview('rev_1', { status: 'approved' });
    expect(prisma.review.update).toHaveBeenCalled();
  });
});
