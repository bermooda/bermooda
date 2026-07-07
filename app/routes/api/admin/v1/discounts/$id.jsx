// GET /api/admin/v1/discounts/:id — get discount
// PATCH /api/admin/v1/discounts/:id — update discount
// DELETE /api/admin/v1/discounts/:id — delete discount
// Requires admin-scoped API key.

import {
  getDiscount,
  updateDiscount,
  deleteDiscount,
} from '#/core/discounts/index.server';

export async function loader({ params }) {
  try {
    const discount = await getDiscount(params.id);
    return Response.json({ discount });
  } catch {
    return Response.json({ error: 'Discount not found' }, { status: 404 });
  }
}

export async function action({ request, params }) {
  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const discount = await updateDiscount(params.id, body);
      return Response.json({ discount });
    } catch (err) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deleteDiscount(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
