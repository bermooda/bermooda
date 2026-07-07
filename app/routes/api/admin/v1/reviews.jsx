// GET /api/admin/v1/reviews — list reviews
// Requires admin-scoped API key.

import {
  listReviews,
  parseReviewListParams,
  REVIEW_STATUSES,
} from '#/core/reviews/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseReviewListParams(url.searchParams);
    const result = await listReviews(params);
    return Response.json({
      ...result,
      reviewStatuses: REVIEW_STATUSES,
    });
  } catch (err) {
    if (err.code === 'INVALID_REVIEW_STATUS') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    throw err;
  }
}
