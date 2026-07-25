// GET /api/admin/v1/media/:id — get a media record
// Requires admin-scoped API key (or media:read).

import { createDomainErrorMapper } from '#/libs/api/admin/index.server';
import { requireAdminApiScope } from '#/libs/auth/api/index.server';
import { getMedia } from '#/core/storage/index.server';

const mapMediaError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params, context }) {
  requireAdminApiScope(context, 'media:read');

  try {
    const media = await getMedia(params.id);
    return Response.json({ media });
  } catch (err) {
    return mapMediaError(err);
  }
}
