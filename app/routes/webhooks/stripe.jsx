import {
  getVerifiedStripeEvent,
  handleCheckoutSessionCompleted,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from '#/services/stripe.server';

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

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }
      case 'customer.subscription.created': {
        await handleCustomerSubscriptionCreated(event.data.object);
        break;
      }
      case 'customer.subscription.updated': {
        await handleCustomerSubscriptionUpdated(event.data.object);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleCustomerSubscriptionDeleted(event.data.object);
        break;
      }
      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
        break;
      }
      default:
        console.warn(`UNHANDLED EVENT: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(`Webhook error: ${error.message}`);
    return Response.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }
}
