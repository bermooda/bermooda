import Stripe from 'stripe';

import config from '#/config';
import prisma from '#/libs/prisma.server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * Get a Stripe checkout session
 *
 * @param {string} priceId - The product price ID to create the session for
 * @param {string} successUrl - The URL to redirect to on success
 * @param {Stripe.Checkout.SessionCreateParams.Mode} [mode='payment'] - The mode of the session
 * @returns {Promise<Stripe.Checkout.Session>} The Stripe session
 */
export async function getCheckoutSession(
  priceId,
  successUrl,
  mode = 'payment'
) {
  // Create a checkout session
  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${config.baseUrl}/${successUrl}`,
    cancel_url: `${config.baseUrl}`,
  });

  return session;
}

/**
 * Get a verified Stripe event from a request
 *
 * @param {Request} request - The request object
 * @returns {Promise<Stripe.Event>} The Stripe event
 */
export async function getVerifiedStripeEvent(request) {
  // Get the signature from the header
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    throw new Response('Missing Stripe signature', { status: 400 });
  }

  // Get the raw body as text for webhook verification
  const rawBody = await request.text();

  // Verify the webhook signature
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET
  );

  return event;
}

/**
 * Handle a checkout session completed event
 *
 * @param {Stripe.Checkout.Session} session - The checkout session
 */
export async function handleCheckoutSessionCompleted(session) {
  console.log('Checkout session completed', session);

  // Get the customer email for signup
  // const customerEmail = session?.customer_details?.email;

  // Only process subscription checkouts
  if (session.mode !== 'subscription') return;

  // Get the subscription details from the session
  const fullSubscription = await stripe.subscriptions.retrieve(
    /** @type {string} */ (session.subscription)
  );

  // Check if we already have a subscription for this customer
  const existingSubscription = await prisma.subscription.findUnique({
    where: { customerId: /** @type {string} */ (fullSubscription.customer) },
  });

  if (existingSubscription) {
    // Update existing subscription
    await prisma.subscription.update({
      where: { customerId: /** @type {string} */ (fullSubscription.customer) },
      data: {
        active: true,
        priceId: fullSubscription?.items?.data[0]?.price?.id,
        status: fullSubscription.status,
      },
    });
  } else {
    // Create new subscription
    // Find user from metadata or client_reference_id
    const userId = /** @type {string} */ (
      session.client_reference_id || session.metadata?.userId
    );

    if (!userId) {
      console.error(
        'No user ID found in session metadata or client_reference_id'
      );
      return;
    }

    await prisma.subscription.create({
      data: {
        customerId: /** @type {string} */ (fullSubscription.customer),
        priceId: fullSubscription?.items?.data[0]?.price?.id,
        status: fullSubscription.status,
        active: true,
        userId,
      },
    });
  }
}

/**
 * Handle a customer subscription created event
 *
 * @param {Stripe.Subscription} subscription - The subscription
 */
export async function handleCustomerSubscriptionCreated(subscription) {
  console.log('Customer subscription created', subscription);

  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id);

  // Create a new subscription in the database
  await prisma.subscription.create({
    data: {
      customerId: /** @type {string} */ (fullSubscription.customer),
      priceId: fullSubscription?.items?.data[0]?.price?.id,
      status: fullSubscription.status,
      userId: subscription.metadata?.userId,
      active: true,
    },
  });
}

/**
 * Handle a customer subscription updated event
 *
 * @param {Stripe.Subscription} subscription - The subscription
 */
export async function handleCustomerSubscriptionUpdated(subscription) {
  console.log('Customer subscription updated', subscription);

  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id);

  // Update the subscription in the database
  await prisma.subscription.update({
    where: {
      customerId: /** @type {string} */ (fullSubscription.customer),
    },
    data: {
      active: subscription.status === 'active',
      priceId: subscription?.items?.data[0]?.price?.id,
      status: subscription.status,
    },
  });
}

/**
 * Handle a customer subscription deleted event
 *
 * @param {Stripe.Subscription} subscription - The subscription
 */
export async function handleCustomerSubscriptionDeleted(subscription) {
  console.log('Customer subscription deleted', subscription);

  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id);

  await prisma.subscription.update({
    where: {
      customerId: /** @type {string} */ (fullSubscription.customer),
    },
    data: {
      active: false,
    },
  });
}

/**
 * Handle an invoice payment failed event
 *
 * @param {Stripe.Invoice} invoice - The invoice
 */
export async function handleInvoicePaymentFailed(invoice) {
  console.log('Invoice payment failed', invoice);

  // Get the subscription ID from the invoice
  const subscriptionId = /** @type {string} */ (invoice.subscription);
  if (!subscriptionId) return;

  // Retrieve the subscription
  const fullSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update the subscription status in the database
  await prisma.subscription.update({
    where: {
      customerId: /** @type {string} */ (fullSubscription.customer),
    },
    data: {
      status: fullSubscription.status,
      // Don't mark as inactive yet, as there might be retry attempts
    },
  });

  // TODO: You might want to send a notification to the user about the failed payment
}

/**
 * Handle an invoice paid event
 *
 * @param {Stripe.Invoice} invoice - The invoice
 */
export async function handleInvoicePaid(invoice) {
  console.log('Invoice paid', invoice);

  // Get the subscription ID from the invoice
  const subscriptionId = /** @type {string} */ (invoice.subscription);
  if (!subscriptionId) return;

  // Retrieve the subscription
  const fullSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update the subscription status in the database
  await prisma.subscription.update({
    where: {
      customerId: /** @type {string} */ (fullSubscription.customer),
    },
    data: {
      active: true,
      status: fullSubscription.status,
    },
  });
}
