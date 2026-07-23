// app/core/payments/paypal/index.server.js
// PayPal payment provider adapter (Orders API v2).

import logger from '#/utils/logger.server';
import { summarizeCartLines } from '#/core/cart/lines';

const log = logger.child({ provider: 'paypal' });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com';

let _accessToken = null;
let _tokenExpiresAt = 0;

function centsToMajorUnit(cents) {
  return (cents / 100).toFixed(2);
}

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiresAt) {
    return _accessToken;
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PAYPAL_NOT_CONFIGURED');
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const body = await response.text();
    log.error({ status: response.status, body }, 'PayPal token request failed');
    throw new Error('PAYPAL_AUTH_FAILED');
  }

  const data = await response.json();
  _accessToken = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

/**
 * PayPal payment provider adapter.
 */
export const paypalProvider = {
  name: 'PayPal',
  requiresRedirect: true,

  /**
   * @param {{ cart?: object, orderId?: string, amountCents?: number, currency?: string, successUrl: string, cancelUrl: string }} params
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
    const totalCents =
      amountCents ?? summarizeCartLines(cart?.lines).subtotalCents;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      log.warn('PayPal credentials missing — returning dev fallback session');
      return {
        id: `paypal_dev_${orderId ?? 'unknown'}`,
        url: successUrl,
      };
    }

    const token = await getAccessToken();
    const currencyCode = (currency ?? cart?.currency ?? 'USD').toUpperCase();
    const value = centsToMajorUnit(totalCents);

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: currencyCode, value },
            custom_id: orderId ?? undefined,
          },
        ],
        application_context: {
          return_url: successUrl,
          cancel_url: cancelUrl,
          brand_name: 'Bermooda',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      log.error(
        { status: response.status, body },
        'PayPal order creation failed'
      );
      throw new Error('PAYPAL_ORDER_FAILED');
    }

    const order = await response.json();
    const approveLink = (order.links ?? []).find((l) => l.rel === 'approve');

    log.info(
      { orderId: order.id, bermoodaOrderId: orderId, amountCents: totalCents },
      'PayPal order created'
    );

    return {
      id: order.id,
      url: approveLink?.href ?? successUrl,
    };
  },

  /**
   * @param {Request} request
   * @returns {Promise<{ event: object, rawBody: string }>}
   */
  async verifyWebhook(request) {
    const rawBody = await request.text();
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new Error('Invalid PayPal webhook payload');
    }

    if (!event?.id || !event?.event_type) {
      throw new Error('Invalid PayPal webhook payload');
    }

    log.info(
      { eventId: event.id, type: event.event_type },
      'PayPal webhook received'
    );
    return { event, rawBody };
  },

  /**
   * @param {object} event
   * @returns {Promise<{ type: string, orderId?: string, amount?: number }>}
   */
  async handleWebhookEvent(event) {
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource ?? {};
        const orderId =
          resource.custom_id ??
          resource.purchase_units?.[0]?.custom_id ??
          resource.supplementary_data?.related_ids?.order_id;
        const amount = resource.amount?.value
          ? Math.round(parseFloat(resource.amount.value) * 100)
          : undefined;

        return { type: 'payment.succeeded', orderId, amount };
      }

      case 'CHECKOUT.ORDER.CANCELLED':
      case 'PAYMENT.CAPTURE.DENIED': {
        const resource = event.resource ?? {};
        const orderId =
          resource.custom_id ?? resource.purchase_units?.[0]?.custom_id;
        return { type: 'payment.failed', orderId };
      }

      default:
        log.info({ type: event.event_type }, 'Unhandled PayPal event type');
        return { type: 'payment.other' };
    }
  },

  /**
   * @param {{ paymentIntentId: string, amountCents: number, currency?: string }} params
   */
  async createRefund({ paymentIntentId, amountCents, currency }) {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('PAYPAL_NOT_CONFIGURED');
    }

    const token = await getAccessToken();
    const currencyCode = (currency ?? 'USD').toUpperCase();
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/payments/captures/${paymentIntentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: {
            value: centsToMajorUnit(amountCents),
            currency_code: currencyCode,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('PAYPAL_REFUND_FAILED');
    }

    const refund = await response.json();
    return { refundId: refund.id, status: refund.status ?? 'succeeded' };
  },
};
