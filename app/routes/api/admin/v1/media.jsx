// POST /api/admin/v1/media — upload a file and create a Media record
// multipart/form-data with field `file`
// Requires admin-scoped API key (or media:write).

import { createDomainErrorMapper } from '#/libs/api/admin/index.server';
import { requireAdminApiScope } from '#/libs/auth/api/index.server';
import { uploadAndCreateMedia } from '#/core/storage/index.server';

const mapMediaError = createDomainErrorMapper({
  badRequest: ['FILE_REQUIRED', 'INVALID_FILE', 'STORAGE_NOT_CONFIGURED'],
});

export async function action({ request, context }) {
  requireAdminApiScope(context, 'media:write');

  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      { status: 405 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: 'Expected multipart/form-data', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return Response.json(
      { error: 'file field is required', code: 'INVALID_FILE' },
      { status: 400 }
    );
  }

  try {
    const media = await uploadAndCreateMedia(file);
    return Response.json({ media }, { status: 201 });
  } catch (err) {
    return mapMediaError(err);
  }
}
