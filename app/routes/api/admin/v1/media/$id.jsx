// GET /api/admin/v1/media/:id — get a media record
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import { getMedia } from '#/core/storage/index.server';

const mapMediaError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const media = await getMedia(params.id);
    return Response.json({ media });
  } catch (err) {
    return mapMediaError(err);
  }
}
