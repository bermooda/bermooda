// GET /api/admin/v1/reviews/:id — get a single review
// PATCH /api/admin/v1/reviews/:id — moderate review status
// DELETE /api/admin/v1/reviews/:id — delete review
// Requires admin-scoped API key.

import {
  deleteReview,
  getReview,
  moderateReview,
  parseModerateReviewInput,
} from '#/core/reviews/index.server';

function reviewErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (err.code === 'INVALID_REVIEW_STATUS') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  try {
    const review = await getReview(params.id);
    return Response.json({ review });
  } catch (err) {
    return reviewErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method === 'DELETE') {
    try {
      await deleteReview(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return reviewErrorResponse(err);
    }
  }

  if (request.method === 'PATCH') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      parseModerateReviewInput(body);
      const review = await moderateReview(params.id, body);
      return Response.json({ review });
    } catch (err) {
      return reviewErrorResponse(err);
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
