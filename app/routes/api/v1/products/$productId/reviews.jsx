import {
  createReview,
  listReviewsForProduct,
} from '#/core/reviews/index.server';

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(50, Number(url.searchParams.get('limit') ?? 10));

  const { reviews, total } = await listReviewsForProduct(params.productId, {
    status: 'approved',
    page,
    limit,
  });

  return Response.json({ reviews, total, page, limit });
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

  if (!body.customerId) {
    return Response.json({ error: 'customerId required' }, { status: 400 });
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
    return Response.json({ error: err.message }, { status: 422 });
  }
}
