// GET /api/admin/v1/reviews — list reviews
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin/index.server';
import {
  listReviews,
  parseReviewListParams,
  REVIEW_STATUSES,
} from '#/core/reviews/index.server';

const mapReviewListError = createDomainErrorMapper({
  badRequest: ['INVALID_REVIEW_STATUS'],
});

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
    return mapReviewListError(err);
  }
}
