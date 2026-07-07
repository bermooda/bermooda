// GET /api/admin/v1/returns — list returns
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import {
  listReturns,
  parseReturnListParams,
  RETURN_RESOLUTIONS,
  RETURN_STATUSES,
} from '#/core/returns/index.server';

const mapReturnListError = createDomainErrorMapper({
  badRequest: ['INVALID_RETURN_STATUS'],
});

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseReturnListParams(url.searchParams);
    const result = await listReturns(params);
    return Response.json({
      ...result,
      returnStatuses: RETURN_STATUSES,
      returnResolutions: RETURN_RESOLUTIONS,
    });
  } catch (err) {
    return mapReturnListError(err);
  }
}
