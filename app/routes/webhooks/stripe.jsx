import logger from '#/utils/logger.server';
import { getVerifiedStripeEvent } from '#/services/stripe.server';

/**
 * Handle a Stripe webhook
 *
 * @param {{request: Request}} params - The request object
 * @returns {Promise<Response>} The response
 */
export async function action({ request }) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const event = await getVerifiedStripeEvent(request);

    logger.info({ type: event.type }, 'Stripe webhook received');

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Stripe webhook error');
    return Response.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }
}
