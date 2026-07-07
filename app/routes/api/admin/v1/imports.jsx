// POST /api/admin/v1/imports — run CSV imports
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  parseImportInput,
  runImport,
  serializeImportResult,
} from '#/core/imports/index.server';

const mapImportError = createDomainErrorMapper({
  badRequest: ['FIELDS_REQUIRED', 'INVALID_IMPORT_TYPE'],
});

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  try {
    const { type, csv } = parseImportInput(parsed.body);
    const result = await runImport(type, csv);
    return Response.json({
      type,
      result: serializeImportResult(result),
    });
  } catch (err) {
    return mapImportError(err);
  }
}
