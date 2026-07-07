// GET /api/admin/v1/returns — list returns
// Requires admin-scoped API key.

import {
  listReturns,
  parseReturnListParams,
  RETURN_RESOLUTIONS,
  RETURN_STATUSES,
} from '#/core/returns/index.server';

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
    if (err.code === 'INVALID_RETURN_STATUS') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    throw err;
  }
}
