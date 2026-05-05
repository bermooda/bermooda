// app/routes/webhooks/$provider.jsx
// Generic webhook dispatcher — handles POST /webhooks/:provider

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { emit } from '#/core/events/index.server';
import { getProvider } from '#/core/payments/index.server';

// Note: payment providers must be registered at server startup.
// See app/core/payments/index.server.js for registerProvider().

/**
 * POST /webhooks/:provider
 *
 * 1. Looks up the payment provider by name from the registry.
 * 2. Calls provider.verifyWebhook(request) to authenticate the payload.
 * 3. Checks for duplicate eventId (idempotency).
 * 4. Writes a WebhookEvent record to the database.
 * 5. Calls provider.handleWebhookEvent(event) and emits the resulting domain event.
 *
 * @param {{ request: Request, params: { provider: string } }} args
 * @returns {Promise<Response>}
 */
export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // 1. Look up provider from registry
  let provider;
  try {
    provider = getProvider(params.provider);
  } catch {
    return Response.json({ error: 'Unknown provider' }, { status: 404 });
  }

  // 2. Verify the webhook signature / payload
  let event, rawBody;
  try {
    ({ event, rawBody } = await provider.verifyWebhook(request));
  } catch (error) {
    logger.error({ err: error }, 'Webhook verification failed');
    return Response.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    );
  }

  // 3. Idempotency — skip if we have already processed this event
  try {
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: params.provider,
          eventId: event.id,
        },
      },
    });

    if (existing) {
      return Response.json(
        { received: true, duplicate: true },
        { status: 200 }
      );
    }

    // 4. Persist the raw event before processing
    await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        eventId: event.id,
        type: event.type,
        payload: rawBody,
        processedAt: new Date(),
      },
    });

    // 5. Let the provider normalise the event into a domain result
    const result = await provider.handleWebhookEvent(event);

    // 6. Emit the domain event so subscribers can react
    await emit(result.type, result);

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Webhook processing error');
    return Response.json({ error: error.message }, { status: 400 });
  }
}
