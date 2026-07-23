// app/core/payments/stripe.server.js
// Stripe payment provider adapter.

import Stripe from 'stripe';

import logger from '#/utils/logger.server';
import { summarizeCartLines } from '#/core/cart/lines';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

const log = logger.child({ provider: 'stripe' });

function buildStripeLineItems(cart, amountCents, currency) {
  const effectiveCurrency = (currency ?? cart?.currency ?? 'USD').toLowerCase();
  const lineSubtotal = summarizeCartLines(cart?.lines).subtotalCents;
  const chargeAmount = amountCents ?? lineSubtotal;

  if (amountCents != null && amountCents !== lineSubtotal) {
    return [
      {
        price_data: {
          currency: effectiveCurrency,
          unit_amount: chargeAmount,
          product_data: { name: 'Order total' },
        },
        quantity: 1,
      },
    ];
  }

  return cart.lines.map((line) => ({
    price_data: {
      currency: effectiveCurrency,
      unit_amount: line.priceCentsSnapshot,
      product_data: {
        name: line.titleSnapshot,
      },
    },
    quantity: line.quantity,
  }));
}

/**
 * Stripe payment provider adapter.
 *
 * Implements the payment provider interface:
 *   name
 *   createCheckoutSession({ cart?, orderId?, amountCents?, currency?, successUrl, cancelUrl })
 *   verifyWebhook(request)
 *   handleWebhookEvent(event)
 *   createRefund({ paymentIntentId, amountCents, reason })
 */
export const stripeProvider = {
  name: 'Stripe',
  requiresRedirect: true,
  supportsPaymentElement: true,

  /**
   * Create a Stripe Checkout session.
   * When amountCents is provided (placed order total), charges that exact amount.
   *
   * @param {{ cart?: Object, orderId?: string, amountCents?: number, currency?: string, successUrl: string, cancelUrl: string }} params
   * @returns {Promise<{ id: string, url: string }>}
   */
  async createCheckoutSession({
    cart,
    orderId,
    amountCents,
    currency,
    successUrl,
    cancelUrl,
  }) {
    const line_items = buildStripeLineItems(cart, amountCents, currency);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(orderId ? { metadata: { orderId } } : {}),
    });

    log.info(
      { sessionId: session.id, orderId, amountCents },
      'Stripe checkout session created'
    );

    return { id: session.id, url: session.url };
  },

  /**
   * Verify a Stripe webhook request.
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
   * @param {{ paymentIntentId: string, amountCents: number, reason?: string }} params
   * @returns {Promise<{ refundId: string, status: string }>}
   */
  async createRefund({ paymentIntentId, amountCents, reason }) {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason: reason ?? 'requested_by_customer',
    });

    log.info(
      { refundId: refund.id, status: refund.status },
      'Stripe refund created'
    );

    return { refundId: refund.id, status: refund.status };
  },

  /**
   * Create a PaymentIntent for Stripe Payment Element.
   *
   * @param {{ cart?: object, orderId?: string, amountCents?: number, currency?: string }} params
   * @returns {Promise<{ clientSecret: string, paymentIntentId: string }>}
   */
  async createPaymentIntent({ cart, orderId, amountCents, currency }) {
    const amount = amountCents ?? summarizeCartLines(cart?.lines).subtotalCents;

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: (currency ?? cart?.currency ?? 'USD').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: orderId ? { orderId } : {},
    });

    log.info({ intentId: intent.id, orderId }, 'Stripe PaymentIntent created');

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  },
};

/** Stripe Payment Element — embedded checkout (no redirect). */
export const stripeElementProvider = {
  name: 'Card on site',
  requiresRedirect: false,
  supportsPaymentElement: true,
  createCheckoutSession: stripeProvider.createCheckoutSession,
  createPaymentIntent: stripeProvider.createPaymentIntent,
  verifyWebhook: stripeProvider.verifyWebhook,
  handleWebhookEvent: stripeProvider.handleWebhookEvent,
  createRefund: stripeProvider.createRefund,
};
