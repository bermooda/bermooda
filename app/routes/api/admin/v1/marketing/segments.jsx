// GET /api/admin/v1/marketing/segments — list segments
// POST /api/admin/v1/marketing/segments — create segment
// Requires admin-scoped API key.

import { createSegment, listSegments } from '#/core/marketing/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  );

  const result = await listSegments({ page, limit });
  return Response.json(result);
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const segment = await createSegment(body);
    return Response.json({ segment }, { status: 201 });
  } catch (err) {
    if (err.code === 'NAME_REQUIRED') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    throw err;
  }
}
