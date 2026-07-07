// GET /api/admin/v1/media/:id — get a media record
// Requires admin-scoped API key.

import { getMedia } from '#/core/storage/index.server';

function mediaErrorResponse(err) {
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
    const media = await getMedia(params.id);
    return Response.json({ media });
  } catch (err) {
    return mediaErrorResponse(err);
  }
}
