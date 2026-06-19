// app/core/payments/stripe.server.js
// Stripe payment provider adapter.

import Stripe from 'stripe';

import logger from '#/utils/logger.server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

const log = logger.child({ provider: 'stripe' });

/**
 * Stripe payment provider adapter.
 *
 * Implements the payment provider interface:
 *   name
 *   createCheckoutSession({ cart, orderId?, successUrl, cancelUrl })
 *   verifyWebhook(request)
 *   handleWebhookEvent(event)
 *   createRefund({ paymentIntentId, amountCents, reason })
 */
export const stripeProvider = {
  name: 'Stripe',
  requiresRedirect: true,
  supportsPaymentElement: true,

  /**
   * Create a Stripe Checkout session using dynamic price_data for each cart line.
   * Pass orderId to include it in Stripe metadata so the webhook can reconcile
   * the payment to the correct order (W0-3).
   *
   * @param {{ cart: Object, orderId?: string, successUrl: string, cancelUrl: string }} params
   * @returns {Promise<Stripe.Checkout.Session>}
   */
  async createCheckoutSession({ cart, orderId, successUrl, cancelUrl }) {
    const line_items = cart.lines.map((line) => ({
      price_data: {
        currency: cart.currency.toLowerCase(),
        unit_amount: line.priceCentsSnapshot,
        product_data: {
          name: line.titleSnapshot,
        },
      },
      quantity: line.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(orderId ? { metadata: { orderId } } : {}),
    });

    log.info(
      { sessionId: session.id, orderId },
      'Stripe checkout session created'
    );

    return session;
  },

  /**
   * Verify a Stripe webhook request.
   * Reads the raw body via request.text() and validates the stripe-signature header.
   *
   * @param {Request} request
   * @returns {Promise<{ event: Stripe.Event, rawBody: string }>}
   */
  async verifyWebhook(request) {
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const rawBody = await request.text();

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    log.info(
      { eventId: event.id, type: event.type },
      'Stripe webhook verified'
    );

    return { event, rawBody };
  },

  /**
   * Handle a verified Stripe webhook event.
   * Returns a normalised payload describing what happened.
   *
   * For checkout.session.completed, the orderId is in session.metadata.orderId
   * (set by createCheckoutSession above — W0-3).
   *
   * @param {Stripe.Event} event
   * @returns {Promise<{ type: string, orderId?: string, amount?: number }>}
   */
  async handleWebhookEvent(event) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        log.info(
          { intentId: intent.id, amount: intent.amount },
          'payment_intent.succeeded'
        );
        return {
          type: 'payment.succeeded',
          orderId: intent.metadata?.orderId,
          amount: intent.amount,
        };
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        log.info(
          { sessionId: session.id, amount: session.amount_total },
          'checkout.session.completed'
        );
        return {
          type: 'payment.succeeded',
          orderId: session.metadata?.orderId,
          amount: session.amount_total,
        };
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        log.info({ sessionId: session.id }, 'checkout.session.expired');
        return {
          type: 'payment.failed',
          orderId: session.metadata?.orderId,
        };
      }

      default: {
        log.info({ type: event.type }, 'Unhandled Stripe event type');
        return { type: 'payment.other' };
      }
    }
  },

  /**
   * Create a Stripe refund for a payment intent.
   *
   * @param {{ paymentIntentId: string, amountCents: number, reason: string }} params
   * @returns {Promise<{ refundId: string, status: string }>}
   */
  async createRefund({ paymentIntentId, amountCents, reason }) {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason,
    });

    log.info(
      { refundId: refund.id, status: refund.status },
      'Stripe refund created'
    );

    return { refundId: refund.id, status: refund.status };
  },

  /**
   * Create a PaymentIntent for Stripe Payment Element / saved methods.
   * Optional express checkout (Apple Pay / Google Pay) via automatic_payment_methods.
   *
   * @param {{ cart: object, orderId?: string, customerId?: string, savePaymentMethod?: boolean }} params
   * @returns {Promise<{ clientSecret: string, paymentIntentId: string }>}
   */
  async createPaymentIntent({
    cart,
    orderId,
    customerId,
    savePaymentMethod = false,
  }) {
    const amount = (cart?.lines ?? []).reduce(
      (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
      0
    );

    const intentParams = {
      amount,
      currency: (cart?.currency ?? 'USD').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: orderId ? { orderId } : {},
    };

    if (customerId) {
      intentParams.customer = customerId;
      if (savePaymentMethod) {
        intentParams.setup_future_usage = 'off_session';
      }
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    log.info(
      { intentId: intent.id, orderId },
      'Stripe PaymentIntent created'
    );

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  },

  /**
   * List saved payment methods for a Stripe customer.
   *
   * @param {string} stripeCustomerId
   * @returns {Promise<object[]>}
   */
  async listSavedPaymentMethods(stripeCustomerId) {
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });
    return methods.data;
  },
};
