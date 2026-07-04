// Stripe Payment Element provider — embedded checkout (no redirect).
import { stripeProvider } from '#/core/payments/stripe.server';

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
