// Generic payment webhook dispatcher — POST /webhooks/:provider

import logger from '#/utils/logger.server';
import { requireMethod } from '#/libs/api/public.server';
import { jsonPaymentWebhookError } from '#/libs/api/webhooks.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';
import { processPaymentProviderWebhook } from '#/core/payments/inbound.server';

export const middleware = [rateLimitMiddleware('webhooks')];

/**
 * @param {{ request: Request, params: { provider: string } }} args
 * @returns {Promise<Response>}
 */
export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  try {
    const result = await processPaymentProviderWebhook(
      params.provider,
      request
    );
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Response) throw error;

    if (error?.status === 404 || error?.code === 'PROVIDER_NOT_FOUND') {
      return Response.json({ error: 'Unknown provider' }, { status: 404 });
    }

    if (error?.code === 'VERIFICATION_FAILED' || error?.status === 400) {
      return jsonPaymentWebhookError(error);
    }

    logger.error(
      { err: error, provider: params.provider },
      'Webhook processing error'
    );
    return jsonPaymentWebhookError(
      Object.assign(error instanceof Error ? error : new Error(String(error)), {
        status: 400,
      })
    );
  }
}
