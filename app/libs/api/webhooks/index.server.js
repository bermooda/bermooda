// Shared helpers for inbound provider webhook routes (/webhooks/:provider).

/**
 * Map a payment webhook domain error to a JSON response.
 *
 * @param {Error & { code?: string, status?: number }} err
 * @returns {Response}
 */
export function jsonPaymentWebhookError(err) {
  const status = err.status ?? 400;
  const message =
    err.code === 'VERIFICATION_FAILED'
      ? 'Webhook verification failed'
      : err.message;

  return Response.json({ error: message }, { status });
}
