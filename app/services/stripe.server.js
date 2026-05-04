import Stripe from 'stripe';

import config from '#/config';

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
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    throw new Response('Missing Stripe signature', { status: 400 });
  }

  const rawBody = await request.text();

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET
  );

  return event;
}
