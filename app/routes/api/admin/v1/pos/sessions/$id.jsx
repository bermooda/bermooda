// GET /api/admin/v1/pos/sessions/:id — get a single POS session
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import { getPosSession } from '#/core/pos/index.server';

const mapPosError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const session = await getPosSession(params.id);
    return Response.json({ session });
  } catch (err) {
    return mapPosError(err);
  }
}
