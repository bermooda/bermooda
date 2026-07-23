// GET /api/admin/v1/customers/:id — get customer
// PATCH /api/admin/v1/customers/:id — update customer
// Requires admin-scoped API key.

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { getCustomer, updateCustomer } from '#/core/customers/index.server';

export async function loader({ params }) {
  const customer = await getCustomer(params.id);
  if (!customer) {
    return Response.json({ error: 'Customer not found' }, { status: 404 });
  }

  return Response.json({ customer });
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    const customer = await updateCustomer(params.id, body);
    return Response.json({ customer });
  } catch (err) {
    return jsonDomainError(err);
  }
}
