import {
  createReview,
  listReviewsForProduct,
  parseCreateReviewInput,
  parseReviewListParams,
} from '#/core/reviews/index.server';

function reviewErrorResponse(err) {
  if (err.code === 'RATING_INVALID' || err.code === 'BODY_REQUIRED') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
  if (err.code === 'DUPLICATE_REVIEW') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
  if (err.code === 'CUSTOMER_ID_REQUIRED') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  const url = new URL(request.url);

  try {
    const query = parseReviewListParams(url.searchParams);
    const result = await listReviewsForProduct(params.productId, {
      page: query.page,
      limit: query.limit,
    });
    return Response.json(result);
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

export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    parseCreateReviewInput({
      productId: params.productId,
      customerId: body.customerId,
      rating: body.rating,
      title: body.title,
      body: body.body,
    });
  } catch (err) {
    if (err.code === 'CUSTOMER_ID_REQUIRED') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    return reviewErrorResponse(err);
  }

  try {
    const review = await createReview({
      productId: params.productId,
      customerId: body.customerId,
      rating: body.rating,
      title: body.title,
      body: body.body,
    });
    return Response.json({ review }, { status: 201 });
  } catch (err) {
    return reviewErrorResponse(err);
  }
}
