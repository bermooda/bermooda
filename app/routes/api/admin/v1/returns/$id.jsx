// GET /api/admin/v1/returns/:id — get a single return
// Requires admin-scoped API key.

import { getReturn } from '#/core/returns/index.server';

function returnErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const returnRecord = await getReturn(params.id);
    return Response.json({ return: returnRecord });
  } catch (err) {
    return returnErrorResponse(err);
  }
}
