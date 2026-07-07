// GET /api/admin/v1/customers/:id/store-credit — balance + ledger
// POST /api/admin/v1/customers/:id/store-credit — issue store credit

import {
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import { getCustomer } from '#/core/customers/index.server';
import {
  getCustomerStoreCreditSummary,
  issueStoreCredit,
  listLedgerEntries,
  parseIssueStoreCreditInput,
} from '#/core/store-credit/index.server';

async function loadCustomerOr404(customerId) {
  const customer = await getCustomer(customerId);
  if (!customer) {
    return {
      error: Response.json({ error: 'Customer not found' }, { status: 404 }),
    };
  }
  return { customer };
}

export async function loader({ request, params }) {
  const result = await loadCustomerOr404(params.id);
  if (result.error) return result.error;

  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);

  const [{ balance }, { entries, total }] = await Promise.all([
    getCustomerStoreCreditSummary(params.id),
    listLedgerEntries(params.id, { page, limit }),
  ]);

  return Response.json({ balance, entries, total, page, limit });
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const result = await loadCustomerOr404(params.id);
  if (result.error) return result.error;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  const input = parseIssueStoreCreditInput(body);
  if (!input.amountCents || input.amountCents <= 0) {
    return Response.json(
      { error: 'amountCents must be greater than zero' },
      { status: 400 }
    );
  }

  try {
    const entry = await issueStoreCredit(params.id, {
      ...input,
      referenceType: input.referenceType ?? 'admin',
    });
    const { balance } = await getCustomerStoreCreditSummary(params.id);
    return Response.json({ entry, balance }, { status: 201 });
  } catch (err) {
    if (err.message === 'INVALID_CREDIT_AMOUNT') {
      return Response.json(
        { error: 'amountCents must be greater than zero' },
        { status: 400 }
      );
    }
    throw err;
  }
}
