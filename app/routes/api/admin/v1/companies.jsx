// GET /api/admin/v1/companies — list companies
// POST /api/admin/v1/companies — create company
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  createCompany,
  listCompanies,
  parseCompanyListParams,
} from '#/core/b2b/index.server';

const mapCompanyError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'NAME_REQUIRED',
    'NET_TERMS_INVALID',
    'COMPANY_ID_REQUIRED',
    'CUSTOMER_ID_REQUIRED',
    'ROLE_INVALID',
    'CUSTOMER_NOT_FOUND',
    'MEMBER_EXISTS',
  ],
});

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseCompanyListParams(url.searchParams);
    const result = await listCompanies(params);
    return Response.json(result);
  } catch (err) {
    return mapCompanyError(err);
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
    const company = await createCompany(body);
    return Response.json({ company }, { status: 201 });
  } catch (err) {
    return mapCompanyError(err);
  }
}
