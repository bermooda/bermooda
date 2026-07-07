import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public.server';
import {
  createReview,
  listReviewsForProduct,
  parseReviewListParams,
  resolveReviewErrorStatus,
} from '#/core/reviews/index.server';

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
    return jsonDomainError(err, {
      defaultStatus: resolveReviewErrorStatus(err),
    });
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    defaultValue: {},
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  try {
    const review = await createReview({
      productId: params.productId,
      customerId: parsed.body.customerId,
      rating: parsed.body.rating,
      title: parsed.body.title,
      body: parsed.body.body,
    });
    return Response.json({ review }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err, {
      defaultStatus: resolveReviewErrorStatus(err),
    });
  }
}
