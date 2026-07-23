// Shared helpers for unauthenticated public REST API routes (/api/v1/*).

/**
 * @returns {Response}
 */
export function methodNotAllowedResponse() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}

/**
 * Return a 405 response when the request method does not match.
 *
 * @param {Request} request
 * @param {string} method
 * @returns {Response|null}
 */
export function requireMethod(request, method) {
  if (request.method !== method) {
    return methodNotAllowedResponse();
  }
  return null;
}

/**
 * Parse a JSON request body.
 *
 * @param {Request} request
 * @param {{ defaultValue?: object, invalidMessage?: string }} [opts]
 * @returns {Promise<{ body: object } | { error: Response }>}
 */
export async function parseJsonBody(
  request,
  { defaultValue = null, invalidMessage = 'Invalid JSON body' } = {}
) {
  try {
    const body = await request.json();
    return { body: body ?? defaultValue ?? {} };
  } catch {
    if (defaultValue !== null) {
      return { body: defaultValue };
    }
    return { error: Response.json({ error: invalidMessage }, { status: 400 }) };
  }
}

/**
 * Map a domain error to a JSON response.
 *
 * @param {Error & { code?: string, status?: number }} err
 * @param {{ defaultStatus?: number }} [opts]
 * @returns {Response}
 */
export function jsonDomainError(err, { defaultStatus = 422 } = {}) {
  return Response.json(
    { error: err.message, code: err.code },
    { status: err.status ?? defaultStatus }
  );
}

/**
 * @returns {Response}
 */
export function cartNotFoundResponse() {
  return Response.json({ error: 'Cart not found' }, { status: 404 });
}
