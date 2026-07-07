// GET /api/admin/v1/pos/sessions/:id — get a single POS session
// Requires admin-scoped API key.

import { getPosSession } from '#/core/pos/index.server';

function posErrorResponse(err) {
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
    const session = await getPosSession(params.id);
    return Response.json({ session });
  } catch (err) {
    return posErrorResponse(err);
  }
}
