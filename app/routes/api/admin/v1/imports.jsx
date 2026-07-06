// POST /api/admin/v1/imports — run CSV imports
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  parseImportInput,
  runImport,
  serializeImportResult,
} from '#/core/imports/index.server';

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const { type, csv } = parseImportInput(body);
    const result = await runImport(type, csv);
    return Response.json({
      type,
      result: serializeImportResult(result),
    });
  } catch (err) {
    if (err.code === 'FIELDS_REQUIRED' || err.code === 'INVALID_IMPORT_TYPE') {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
