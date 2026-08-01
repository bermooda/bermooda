// Inbound payment-provider webhook processing (POST /webhooks/:provider).

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { queueEmit } from '#/core/events/job.server';
import { getProvider } from '#/core/payments/index.server';

/**
 * Resolve a payment provider id or throw a 404 domain error.
 *
 * @param {string} providerId
 * @returns {object}
 */
export function resolvePaymentProvider(providerId) {
  try {
    return getProvider(providerId);
  } catch {
    throw Object.assign(new Error('Unknown provider'), {
      code: 'PROVIDER_NOT_FOUND',
      status: 404,
    });
  }
}

/**
 * Normalize provider event type from common payload shapes.
 *
 * @param {object} event
 * @returns {string}
 */
export function normalizeWebhookEventType(event) {
  return event.type ?? event.event_type ?? 'unknown';
}

/**
 * Verify, dedupe, persist, and dispatch a payment-provider webhook.
 *
 * @param {string} providerId
 * @param {Request} request
 * @returns {Promise<{ received: true, duplicate?: true }>}
 */
export async function processPaymentProviderWebhook(providerId, request) {
  const provider = resolvePaymentProvider(providerId);

  let event;
  let rawBody;
  try {
    ({ event, rawBody } = await provider.verifyWebhook(request));
  } catch (error) {
    logger.error({ err: error, providerId }, 'Webhook verification failed');
    throw Object.assign(new Error('Webhook verification failed'), {
      code: 'VERIFICATION_FAILED',
      status: 400,
    });
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: providerId,
        eventId: event.id,
      },
    },
  });

  if (existing) {
    return { received: true, duplicate: true };
  }

  await prisma.webhookEvent.create({
    data: {
      provider: providerId,
      eventId: event.id,
      type: normalizeWebhookEventType(event),
      payload: rawBody,
      processedAt: new Date(),
    },
  });

  const result = await provider.handleWebhookEvent(event);
  await queueEmit(result.type, result);

  return { received: true };
}
