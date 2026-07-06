// GET /api/admin/v1/customers/:id/store-credit — balance + ledger
// POST /api/admin/v1/customers/:id/store-credit — issue store credit

import { requireApiKey } from '#/libs/auth/api.server';

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
  await requireApiKey(request, ['admin']);

  const result = await loadCustomerOr404(params.id);
  if (result.error) return result.error;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );

  const [{ balance }, { entries, total }] = await Promise.all([
    getCustomerStoreCreditSummary(params.id),
    listLedgerEntries(params.id, { page, limit }),
  ]);

  return Response.json({ balance, entries, total, page, limit });
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const result = await loadCustomerOr404(params.id);
  if (result.error) return result.error;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
