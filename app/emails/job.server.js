import config from '#bermooda.config';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import queue, { createThrottledJob, defineQueueJob } from '#/libs/queue.server';
import { on } from '#/core/events/index.server';
import {
  sendPasswordResetEmail,
  sendTwoFactorOtpEmail,
  sendVerificationEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderRefundedEmail,
  sendReturnReceivedEmail,
  sendCustomerWelcomeEmail,
  sendAbandonedCartEmail,
} from '#/emails/index.server';

const verifyEmailJob = defineQueueJob(queue, 'verify_email', {
  process: async (taskData) => {
    await sendVerificationEmail({
      email: taskData.email,
      name: taskData.name,
      verificationUrl: taskData.url,
    });
  },
  onFailed: {
    message: 'Verify email job failed',
    source: 'emails/job.server verifyEmailJob',
  },
});

const passwordResetEmailJob = defineQueueJob(queue, 'password_reset_email', {
  process: async (taskData) => {
    await sendPasswordResetEmail({
      email: taskData.email,
      name: taskData.name,
      resetUrl: taskData.url,
    });
  },
  onFailed: {
    message: 'Password reset email job failed',
    source: 'emails/job.server passwordResetEmailJob',
  },
});

const twoFactorOtpJob = defineQueueJob(queue, 'two_factor_otp', {
  process: async (taskData) => {
    await sendTwoFactorOtpEmail({
      email: taskData.email,
      name: taskData.name,
      otp: taskData.otp,
    });
  },
  onFailed: {
    message: 'Two-factor OTP email job failed',
    source: 'emails/job.server twoFactorOtpJob',
  },
});

/**
 * Queues a verification email to be sent
 *
 * @param {string} email - The email address to send the verification email to
 * @param {string} name - The name of the user to send the verification email to
 * @param {string} verificationUrl - The URL to verify the email
 */
export function queueVerifyEmail(email, name, verificationUrl) {
  logger.info(`Queueing verification email to: ${email}`);

  verifyEmailJob.add({
    email,
    name,
    url: verificationUrl,
  });
}

/**
 * Queues a password reset email to be sent
 *
 * @param {string} email - The email address to send the password reset email to
 * @param {string} name - The name of the user to send the password reset email to
 * @param {string} resetUrl - The URL to reset the password
 */
export function queuePasswordResetEmail(email, name, resetUrl) {
  logger.info(`Queueing password reset email to: ${email}`);

  passwordResetEmailJob.add({
    email,
    name,
    url: resetUrl,
  });
}

export const queueTwoFactorOtp = createThrottledJob(
  function queueTwoFactorOtpInternal(email, name, otp) {
    logger.info(`Queueing two-factor OTP email to: ${email}`);

    twoFactorOtpJob.add({
      email,
      name,
      otp,
    });
  },
  (email) => `otp:${email}`,
  5000
);

// ─── Shop email jobs ──────────────────────────────────────────────────────────

const orderConfirmationJob = defineQueueJob(queue, 'order_confirmation_email', {
  process: async (taskData) => {
    await sendOrderConfirmationEmail(taskData);
  },
  onFailed: {
    message: 'Order confirmation email job failed',
    source: 'emails/job.server orderConfirmationJob',
  },
});

const orderShippedJob = defineQueueJob(queue, 'order_shipped_email', {
  process: async (taskData) => {
    await sendOrderShippedEmail(taskData);
  },
  onFailed: {
    message: 'Order shipped email job failed',
    source: 'emails/job.server orderShippedJob',
  },
});

const orderDeliveredJob = defineQueueJob(queue, 'order_delivered_email', {
  process: async (taskData) => {
    await sendOrderDeliveredEmail(taskData);
  },
  onFailed: {
    message: 'Order delivered email job failed',
    source: 'emails/job.server orderDeliveredJob',
  },
});

const orderRefundedJob = defineQueueJob(queue, 'order_refunded_email', {
  process: async (taskData) => {
    await sendOrderRefundedEmail(taskData);
  },
  onFailed: {
    message: 'Order refunded email job failed',
    source: 'emails/job.server orderRefundedJob',
  },
});

const returnReceivedJob = defineQueueJob(queue, 'return_received_email', {
  process: async (taskData) => {
    await sendReturnReceivedEmail(taskData);
  },
  onFailed: {
    message: 'Return received email job failed',
    source: 'emails/job.server returnReceivedJob',
  },
});

const customerWelcomeJob = defineQueueJob(queue, 'customer_welcome_email', {
  process: async (taskData) => {
    await sendCustomerWelcomeEmail(taskData);
  },
  onFailed: {
    message: 'Customer welcome email job failed',
    source: 'emails/job.server customerWelcomeJob',
  },
});

const abandonedCartJob = defineQueueJob(queue, 'abandoned_cart_email', {
  process: async (taskData) => {
    await sendAbandonedCartEmail(taskData);
  },
  onFailed: {
    message: 'Abandoned cart email job failed',
    source: 'emails/job.server abandonedCartJob',
  },
});

/**
 * Queues an order confirmation email.
 *
 * @param {Object} payload - Data for the OrderConfirmationEmail template
 */
export function queueOrderConfirmation(payload) {
  logger.info(
    { orderId: payload.orderId },
    'Queueing order confirmation email'
  );
  orderConfirmationJob.add(payload);
}

export function queueOrderShipped(payload) {
  logger.info({ orderId: payload.orderId }, 'Queueing order shipped email');
  orderShippedJob.add(payload);
}

export function queueOrderDelivered(payload) {
  logger.info({ orderId: payload.orderId }, 'Queueing order delivered email');
  orderDeliveredJob.add(payload);
}

export function queueOrderRefunded(payload) {
  logger.info({ orderId: payload.orderId }, 'Queueing order refunded email');
  orderRefundedJob.add(payload);
}

export function queueReturnReceived(payload) {
  logger.info({ returnId: payload.returnId }, 'Queueing return received email');
  returnReceivedJob.add(payload);
}

/**
 * Queues a customer welcome email.
 *
 * @param {string} email
 * @param {string} name
 * @param {string} [locale]
 * @param {string} [accountUrl]
 */
export function queueCustomerWelcome(email, name, locale = 'en', accountUrl) {
  logger.info(`Queueing customer welcome email to: ${email}`);
  customerWelcomeJob.add({ email, name, locale, accountUrl });
}

/**
 * Queues an abandoned-cart reminder email.
 *
 * @param {Object} payload - Data for the AbandonedCartEmail template
 */
export function queueAbandonedCart(payload) {
  logger.info({ email: payload.email }, 'Queueing abandoned cart email');
  abandonedCartJob.add(payload);
}

// ─── Event bus subscriptions ──────────────────────────────────────────────────

on('order.created', (payload) => {
  if (!payload.email) return;
  queueOrderConfirmation({
    email: payload.email,
    locale: payload.locale ?? 'en',
    name: payload.customerName ?? 'there',
    orderNumber: payload.orderNumber,
    orderUrl: payload.orderUrl,
    lines: payload.lines ?? [],
    subtotalCents: payload.subtotalCents ?? 0,
    shippingCents: payload.shippingCents ?? 0,
    taxCents: payload.taxCents ?? 0,
    discountCents: payload.discountCents ?? 0,
    totalCents: payload.totalCents ?? 0,
    currency: payload.currency ?? 'USD',
  });
});

on('customer.registered', (payload) => {
  if (!payload.email) return;
  queueCustomerWelcome(
    payload.email,
    payload.name ?? 'there',
    payload.locale ?? 'en'
  );
});

// W4: lifecycle emails for fulfillment and returns
on('shipment.shipped', async (payload) => {
  const order = await loadOrderEmailContext(payload.orderId);
  if (!order?.email) return;
  queueOrderShipped({
    email: order.email,
    locale: order.locale ?? 'en',
    orderNumber: order.orderNumber,
    orderUrl: order.orderUrl,
    carrier: payload.carrier,
    trackingNumber: payload.trackingNumber,
    trackingUrl: payload.trackingUrl,
    orderId: payload.orderId,
  });
});

on('shipment.delivered', async (payload) => {
  const order = await loadOrderEmailContext(payload.orderId);
  if (!order?.email) return;
  queueOrderDelivered({
    email: order.email,
    locale: order.locale ?? 'en',
    orderNumber: order.orderNumber,
    orderUrl: order.orderUrl,
    orderId: payload.orderId,
  });
});

on('payment.refunded', async (payload) => {
  const order = await loadOrderEmailContext(payload.orderId);
  if (!order?.email) return;
  queueOrderRefunded({
    email: order.email,
    locale: order.locale ?? 'en',
    orderNumber: order.orderNumber,
    orderUrl: order.orderUrl,
    amountCents: payload.amountCents ?? 0,
    currency: order.currency ?? 'USD',
    orderId: payload.orderId,
  });
});

on('return.received', async (payload) => {
  const order = await loadOrderEmailContext(payload.orderId);
  if (!order?.email) return;
  queueReturnReceived({
    email: order.email,
    locale: order.locale ?? 'en',
    orderNumber: order.orderNumber,
    orderUrl: order.orderUrl,
    returnId: payload.returnId,
  });
});

/**
 * Load minimal order context for lifecycle emails.
 * @param {string} orderId
 */
async function loadOrderEmailContext(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      email: true,
      currency: true,
      customer: { select: { preferredLocale: true } },
    },
  });

  if (!order) return null;

  return {
    email: order.email,
    orderNumber: order.orderNumber,
    currency: order.currency,
    locale: order.customer?.preferredLocale ?? 'en',
    orderUrl: `${config.baseUrl}/account/orders/${order.id}`,
  };
}
