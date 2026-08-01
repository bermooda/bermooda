// app/core/webhooks/job.server.js
// LiteQuu delivery worker: signs and POSTs webhook payloads with retry back-off.
// Callers import queueWebhookDelivery from this module.

import { createHmac } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { defineQueueJob } from '#/libs/queue.server';

const MAX_ATTEMPTS = 5;
// Exponential back-off: 30 s → 2 min → 10 min → 30 min → 2 h
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];

/**
 * Return a HMAC-SHA256 signature string for the given payload + secret.
 * @param {string} secret
 * @param {string} payload
 * @returns {string} "sha256=<hex>"
 */
function sign(secret, payload) {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

const webhookDeliveryJob = defineQueueJob('webhook_delivery', {
  process: async (taskData) => {
    const { deliveryId } = taskData;

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true },
    });

    if (!delivery) {
      logger.warn({ deliveryId }, 'Webhook delivery not found; skipping');
      return;
    }

    if (delivery.status === 'success') return;

    const { subscription, payload } = delivery;
    const attempt = delivery.attempts + 1;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: attempt, lastAttemptAt: new Date() },
    });

    const signature = sign(subscription.secret, payload);

    let responseStatus = null;
    let responseBody = null;
    let error = null;
    let success = false;

    try {
      const res = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bermooda-Signature': signature,
          'X-Bermooda-Event': delivery.event,
          'X-Bermooda-Delivery': deliveryId,
        },
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });

      responseStatus = res.status;
      // Cap stored response to 1 KB
      responseBody = (await res.text()).slice(0, 1024);
      success = res.ok;
    } catch (err) {
      error = err.message;
      logger.warn(
        { deliveryId, err: err.message, attempt },
        'Webhook HTTP error'
      );
    }

    if (success) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'success', responseStatus, responseBody, error: null },
      });
      logger.info(
        { deliveryId, url: subscription.url, attempt },
        'Webhook delivered'
      );
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'pending',
          responseStatus,
          responseBody,
          error,
          nextRetryAt,
        },
      });

      setTimeout(() => {
        webhookDeliveryJob.add({ deliveryId });
      }, delayMs);

      logger.info({ deliveryId, attempt, delayMs }, 'Webhook retry scheduled');
    } else {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', responseStatus, responseBody, error },
      });
      logger.warn(
        { deliveryId, url: subscription.url },
        'Webhook permanently failed after max attempts'
      );
    }
  },
  onFailed: {
    message: 'Webhook delivery job crashed',
    source: 'core/webhooks/job.server webhookDeliveryJob',
  },
});

/**
 * Queue a webhook delivery attempt.
 *
 * @param {{ deliveryId: string }} taskData
 * @returns {void}
 */
export function queueWebhookDelivery(taskData) {
  logger.info({ deliveryId: taskData.deliveryId }, 'Queueing webhook delivery');
  webhookDeliveryJob.add(taskData);
}
