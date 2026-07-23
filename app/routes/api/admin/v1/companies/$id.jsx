// GET /api/admin/v1/companies/:id — get company
// POST /api/admin/v1/companies/:id — add company member
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  addCompanyMember,
  getCompany,
  parseAddCompanyMemberInput,
} from '#/core/b2b/index.server';

const mapCompanyError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'COMPANY_ID_REQUIRED',
    'CUSTOMER_ID_REQUIRED',
    'ROLE_INVALID',
    'CUSTOMER_NOT_FOUND',
    'MEMBER_EXISTS',
  ],
});

export async function loader({ params }) {
  try {
    const company = await getCompany(params.id);
    return Response.json({ company });
  } catch (err) {
    return mapCompanyError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    const member = await addCompanyMember(
      parseAddCompanyMemberInput({ ...body, companyId: params.id })
    );
    return Response.json({ member }, { status: 201 });
  } catch (err) {
    return mapCompanyError(err);
  }
}
