// GET /api/admin/v1/quotes — list quotes
// POST /api/admin/v1/quotes — create quote
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  createQuote,
  listQuotes,
  parseQuoteListParams,
  QUOTE_STATUSES,
} from '#/core/b2b/index.server';

function quoteErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'INVALID_QUOTE_STATUS' ||
    err.code === 'COMPANY_ID_REQUIRED' ||
    err.code === 'QUOTE_LINES_REQUIRED' ||
    err.code === 'INVALID_QUOTE_LINE' ||
    err.code === 'INVALID_QUOTE_LINE_PRICE' ||
    err.code === 'EXPIRES_AT_INVALID' ||
    err.code === 'CUSTOMER_NOT_FOUND' ||
    err.code === 'VARIANT_NOT_FOUND'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);

  try {
    const params = parseQuoteListParams(url.searchParams);
    const result = await listQuotes(params);
    return Response.json({
      ...result,
      quoteStatuses: QUOTE_STATUSES,
    });
  } catch (err) {
    return quoteErrorResponse(err);
  }
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

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
    const quote = await createQuote(body);
    return Response.json({ quote }, { status: 201 });
  } catch (err) {
    return quoteErrorResponse(err);
  }
}
