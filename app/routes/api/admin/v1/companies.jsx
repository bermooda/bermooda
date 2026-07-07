// GET /api/admin/v1/companies — list companies
// POST /api/admin/v1/companies — create company
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  createCompany,
  listCompanies,
  parseCompanyListParams,
} from '#/core/b2b/index.server';

function companyErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'NAME_REQUIRED' ||
    err.code === 'NET_TERMS_INVALID' ||
    err.code === 'COMPANY_ID_REQUIRED' ||
    err.code === 'CUSTOMER_ID_REQUIRED' ||
    err.code === 'ROLE_INVALID' ||
    err.code === 'CUSTOMER_NOT_FOUND' ||
    err.code === 'MEMBER_EXISTS'
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
    const params = parseCompanyListParams(url.searchParams);
    const result = await listCompanies(params);
    return Response.json(result);
  } catch (err) {
    return companyErrorResponse(err);
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
    const company = await createCompany(body);
    return Response.json({ company }, { status: 201 });
  } catch (err) {
    return companyErrorResponse(err);
  }
}
