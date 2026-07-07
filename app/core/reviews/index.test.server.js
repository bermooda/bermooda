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
    translation: { findMany: vi.fn() },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';
import {
  buildReviewWhere,
  createReview,
  deleteReview,
  formatReviewSummary,
  getReview,
  getReviewSummary,
  hasVerifiedPurchase,
  listReviews,
  moderateReview,
  parseCreateReviewInput,
  parseModerateReviewInput,
  parseReviewListParams,
  parseReviewModerationFromForm,
  resolveReviewErrorStatus,
  REVIEW_STATUSES,
  serializeReview,
} from '#/core/reviews/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseReviewListParams', () => {
  it('parses pagination and filters', () => {
    const params = parseReviewListParams(
      new URLSearchParams('page=2&limit=10&status=approved&productId=prod_1')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      status: 'approved',
      productId: 'prod_1',
    });
  });

  it('rejects invalid status filters', () => {
    expect(() => parseReviewListParams({ status: 'bogus' })).toThrow(
      'Invalid review status filter'
    );
  });
});

describe('buildReviewWhere', () => {
  it('omits status when all is selected', () => {
    expect(buildReviewWhere({ status: 'all', productId: 'prod_1' })).toEqual({
      productId: 'prod_1',
    });
  });
});

describe('formatReviewSummary', () => {
  it('rounds average rating to one decimal', () => {
    expect(formatReviewSummary(4.56, 3)).toEqual({
      averageRating: 4.6,
      count: 3,
    });
  });
});

describe('parseCreateReviewInput', () => {
  it('validates rating and body', () => {
    expect(() =>
      parseCreateReviewInput({
        productId: 'prod_1',
        customerId: 'cust_1',
        rating: 6,
        body: 'Nice',
      })
    ).toThrow('Rating must be between 1 and 5');
  });
});

describe('resolveReviewErrorStatus', () => {
  it('maps customer and list validation errors to 400', () => {
    expect(
      resolveReviewErrorStatus(
        Object.assign(new Error('missing customer'), {
          code: 'CUSTOMER_ID_REQUIRED',
        })
      )
    ).toBe(400);
    expect(
      resolveReviewErrorStatus(
        Object.assign(new Error('bad status'), {
          code: 'INVALID_REVIEW_STATUS',
        })
      )
    ).toBe(400);
  });

  it('defaults other review errors to 422', () => {
    expect(
      resolveReviewErrorStatus(
        Object.assign(new Error('duplicate'), { code: 'DUPLICATE_REVIEW' })
      )
    ).toBe(422);
  });
});

describe('parseModerateReviewInput', () => {
  it('accepts approved status', () => {
    expect(parseModerateReviewInput({ status: 'approved' })).toEqual({
      status: 'approved',
    });
  });

  it('rejects invalid status', () => {
    expect(() => parseModerateReviewInput({ status: 'bogus' })).toThrow(
      'Invalid review status'
    );
  });
});

describe('parseReviewModerationFromForm', () => {
  it('maps approve intent to approved status', () => {
    const formData = new FormData();
    formData.set('id', 'rev_1');
    formData.set('intent', 'approve');
    expect(parseReviewModerationFromForm(formData)).toEqual({
      id: 'rev_1',
      status: 'approved',
    });
  });
});

describe('serializeReview', () => {
  it('includes product title and customer name', () => {
    const serialized = serializeReview(
      {
        id: 'rev_1',
        productId: 'prod_1',
        customerId: 'cust_1',
        rating: 5,
        title: null,
        body: 'Great',
        status: 'approved',
        verifiedPurchase: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        customer: { id: 'cust_1', name: 'Ada', email: 'ada@example.com' },
      },
      { productTitle: 'Blue Tee' }
    );

    expect(serialized.productTitle).toBe('Blue Tee');
    expect(serialized.customerName).toBe('Ada');
  });
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

describe('listReviews', () => {
  it('returns paginated serialized reviews with product titles', async () => {
    prisma.review.findMany.mockResolvedValue([
      {
        id: 'rev_1',
        productId: 'prod_1',
        customerId: 'cust_1',
        rating: 5,
        title: null,
        body: 'Great',
        status: 'pending',
        verifiedPurchase: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        product: { id: 'prod_1' },
        customer: { id: 'cust_1', name: 'Ada', email: 'ada@example.com' },
      },
    ]);
    prisma.review.count.mockResolvedValue(1);
    prisma.translation.findMany.mockResolvedValue([
      { entityId: 'prod_1', value: 'Blue Tee' },
    ]);

    const result = await listReviews({ status: 'pending', page: 1, limit: 20 });

    expect(result.reviews[0].productTitle).toBe('Blue Tee');
    expect(result.total).toBe(1);
    expect(REVIEW_STATUSES).toContain('pending');
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
    prisma.review.create.mockResolvedValue({
      id: 'rev_1',
      productId: 'prod_1',
      customerId: 'cust_1',
      rating: 5,
      title: null,
      body: 'Love it',
      status: 'pending',
      verifiedPurchase: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      product: { id: 'prod_1' },
      customer: { id: 'cust_1', name: null, email: 'cust@example.com' },
    });
    prisma.translation.findMany.mockResolvedValue([]);

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

describe('getReview', () => {
  it('throws when review is missing', async () => {
    prisma.review.findUnique.mockResolvedValue(null);
    await expect(getReview('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('moderateReview', () => {
  it('updates review status', async () => {
    const review = {
      id: 'rev_1',
      productId: 'prod_1',
      customerId: 'cust_1',
      rating: 5,
      title: null,
      body: 'Nice',
      status: 'pending',
      verifiedPurchase: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      product: { id: 'prod_1' },
      customer: { id: 'cust_1', name: 'Ada', email: 'ada@example.com' },
    };
    prisma.review.findUnique.mockResolvedValue(review);
    prisma.review.update.mockResolvedValue({ ...review, status: 'approved' });
    prisma.translation.findMany.mockResolvedValue([]);

    const updated = await moderateReview('rev_1', { status: 'approved' });
    expect(updated.status).toBe('approved');
    expect(prisma.review.update).toHaveBeenCalled();
  });
});

describe('deleteReview', () => {
  it('throws when review is missing', async () => {
    prisma.review.findUnique.mockResolvedValue(null);
    await expect(deleteReview('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
