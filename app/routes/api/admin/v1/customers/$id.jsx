// GET /api/admin/v1/customers/:id — get customer
// PATCH /api/admin/v1/customers/:id — update customer
// Requires admin-scoped API key.

import { getCustomer, updateCustomer } from '#/core/customers/index.server';

export async function loader({ params }) {
  const customer = await getCustomer(params.id);
  if (!customer) {
    return Response.json({ error: 'Customer not found' }, { status: 404 });
  }

  return Response.json({ customer });
}

export async function action({ request, params }) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const customer = await updateCustomer(params.id, body);
    return Response.json({ customer });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
