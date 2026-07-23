// GET /api/admin/v1/marketing/abandoned-cart-sequences/:id — get sequence step
// PATCH /api/admin/v1/marketing/abandoned-cart-sequences/:id — update sequence step
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  getAbandonedCartSequence,
  updateAbandonedCartSequence,
} from '#/core/marketing/index.server';

const mapSequenceError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function sequenceNotFoundResponse() {
  return Response.json(
    { error: 'Abandoned cart sequence not found' },
    { status: 404 }
  );
}

export async function loader({ params }) {
  try {
    const sequence = await getAbandonedCartSequence(params.id);
    return Response.json({ sequence });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return sequenceNotFoundResponse();
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const sequence = await updateAbandonedCartSequence(params.id, parsed.body);
    return Response.json({ sequence });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return sequenceNotFoundResponse();
    }
    return mapSequenceError(err);
  }
}
