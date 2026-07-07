// GET /api/admin/v1/quotes/:id — get quote
// PATCH /api/admin/v1/quotes/:id — update quote status
// Requires admin-scoped API key.

import {
  acceptQuote,
  getQuote,
  parseUpdateQuoteStatusInput,
  sendQuote,
  updateQuoteStatus,
} from '#/core/b2b/index.server';

function quoteErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (err.code === 'INVALID_QUOTE_STATUS') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const quote = await getQuote(params.id);
    return Response.json({ quote });
  } catch (err) {
    return quoteErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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
    return quoteErrorResponse(err);
  }
}
