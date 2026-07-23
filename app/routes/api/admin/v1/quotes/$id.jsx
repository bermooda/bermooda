// GET /api/admin/v1/quotes/:id — get quote
// PATCH /api/admin/v1/quotes/:id — update quote status
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  acceptQuote,
  getQuote,
  parseUpdateQuoteStatusInput,
  sendQuote,
  updateQuoteStatus,
} from '#/core/b2b/index.server';

const mapQuoteError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: ['INVALID_QUOTE_STATUS'],
});

export async function loader({ params }) {
  try {
    const quote = await getQuote(params.id);
    return Response.json({ quote });
  } catch (err) {
    return mapQuoteError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    if (body.action === 'send') {
      const quote = await sendQuote(params.id);
      return Response.json({ quote });
    }

    if (body.action === 'accept') {
      const quote = await acceptQuote(params.id, body.orderId);
      return Response.json({ quote });
    }

    parseUpdateQuoteStatusInput(body);
    const quote = await updateQuoteStatus(params.id, body);
    return Response.json({ quote });
  } catch (err) {
    return mapQuoteError(err);
  }
}
