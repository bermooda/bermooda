// GET /api/admin/v1/returns/:id — get a single return
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import { getReturn } from '#/core/returns/index.server';

const mapReturnError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const returnRecord = await getReturn(params.id);
    return Response.json({ return: returnRecord });
  } catch (err) {
    return mapReturnError(err);
  }
}
