// GET /api/admin/v1/quotes — list quotes
// POST /api/admin/v1/quotes — create quote
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  createQuote,
  listQuotes,
  parseQuoteListParams,
  QUOTE_STATUSES,
} from '#/core/b2b/index.server';

const mapQuoteError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'INVALID_QUOTE_STATUS',
    'COMPANY_ID_REQUIRED',
    'QUOTE_LINES_REQUIRED',
    'INVALID_QUOTE_LINE',
    'INVALID_QUOTE_LINE_PRICE',
    'EXPIRES_AT_INVALID',
    'CUSTOMER_NOT_FOUND',
    'VARIANT_NOT_FOUND',
  ],
});

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseQuoteListParams(url.searchParams);
    const result = await listQuotes(params);
    return Response.json({
      ...result,
      quoteStatuses: QUOTE_STATUSES,
    });
  } catch (err) {
    return mapQuoteError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    const quote = await createQuote(body);
    return Response.json({ quote }, { status: 201 });
  } catch (err) {
    return mapQuoteError(err);
  }
}
