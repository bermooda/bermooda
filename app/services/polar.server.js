import prisma from '#/libs/prisma.server';

/**
 * Handle an order created event
 *
 * @param {Object} order - The order object
 */
export async function handleOrderCreated(order) {
  console.log('Order created', order);

  // Implement order created logic
  // Check for billing_reason to handle one time product purchases
  if (order.billing_reason === 'purchase') {
    console.log('One time product purchase', order);
  }
}

/**
 * Handle an order paid event
 *
 * @param {Object} order - The order object
 */
export async function handleOrderPaid(order) {
  console.log('Order paid', order);

  // Implement order paid logic
}

/**
 * Handle an order refunded event
 *
 * @param {Object} order - The order object
 */
export async function handleOrderRefunded(order) {
  console.log('Order refunded', order);

  // Implement order refunded logic
}

/**
 * Handle a subscription created event
 *
 * @param {Object} subscription - The subscription object
 */
export async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created', subscription);

  // Create a new subscription in the database
  // Similar to how Stripe subscriptions are handled
  await prisma.subscription.create({
    data: {
      customerId: subscription.customer_id,
      priceId: subscription.price_id,
      status: subscription.status,
      userId: subscription.metadata?.userId,
      active: subscription.status === 'active',
    },
  });
}

/**
 * Handle a subscription updated event
 *
 * @param {Object} subscription - The subscription object
 */
export async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated', subscription);

  // Update the subscription in the database
  await prisma.subscription.update({
    where: {
      customerId: subscription.customer_id,
    },
    data: {
      active: subscription.status === 'active',
      priceId: subscription.price_id,
      status: subscription.status,
    },
  });
}

/**
 * Handle a subscription active event
 *
 * @param {Object} subscription - The subscription object
 */
export async function handleSubscriptionActive(subscription) {
  console.log('Subscription active', subscription);

  // Update the subscription status in the database
  await prisma.subscription.update({
    where: {
      customerId: subscription.customer_id,
    },
    data: {
      active: true,
      status: 'active',
    },
  });
}

/**
 * Handle a subscription canceled event
 *
 * @param {Object} subscription - The subscription object
 */
export async function handleSubscriptionCanceled(subscription) {
  console.log('Subscription canceled', subscription);

  // Update the subscription status in the database
  await prisma.subscription.update({
    where: {
      customerId: subscription.customer_id,
    },
    data: {
      status: 'canceled',
      // Don't mark as inactive yet until the subscription period ends
    },
  });
}

/**
 * Handle a subscription revoked event
 *
 * @param {Object} subscription - The subscription object
 */
export async function handleSubscriptionRevoked(subscription) {
  console.log('Subscription revoked', subscription);

  // Update the subscription in the database to be inactive
  await prisma.subscription.update({
    where: {
      customerId: subscription.customer_id,
    },
    data: {
      active: false,
      status: 'revoked',
    },
  });
}
