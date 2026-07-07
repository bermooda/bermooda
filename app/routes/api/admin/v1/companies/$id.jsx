// GET /api/admin/v1/companies/:id — get company
// POST /api/admin/v1/companies/:id — add company member
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  addCompanyMember,
  getCompany,
  parseAddCompanyMemberInput,
} from '#/core/b2b/index.server';

function companyErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
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

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const company = await getCompany(params.id);
    return Response.json({ company });
  } catch (err) {
    return companyErrorResponse(err);
  }
}

export async function action({ request, params }) {
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
    const member = await addCompanyMember(
      parseAddCompanyMemberInput({ ...body, companyId: params.id })
    );
    return Response.json({ member }, { status: 201 });
  } catch (err) {
    return companyErrorResponse(err);
  }
}
