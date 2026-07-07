// GET /api/admin/v1/reviews/:id — get a single review
// PATCH /api/admin/v1/reviews/:id — moderate review status
// DELETE /api/admin/v1/reviews/:id — delete review
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  deleteReview,
  getReview,
  moderateReview,
  parseModerateReviewInput,
} from '#/core/reviews/index.server';

const mapReviewError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: ['INVALID_REVIEW_STATUS'],
});

export async function loader({ params }) {
  try {
    const review = await getReview(params.id);
    return Response.json({ review });
  } catch (err) {
    return mapReviewError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'DELETE') {
    try {
      await deleteReview(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return mapReviewError(err);
    }
  }

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    parseModerateReviewInput(parsed.body);
    const review = await moderateReview(params.id, parsed.body);
    return Response.json({ review });
  } catch (err) {
    return mapReviewError(err);
  }
}
