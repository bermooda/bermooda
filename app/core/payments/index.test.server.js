// app/core/payments/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available inside vi.mock factories
// (vi.mock calls are hoisted to the top of the file by Vitest/Vite).
// ---------------------------------------------------------------------------

const { mockSessionCreate, mockRefundsCreate, mockConstructEvent } = vi.hoisted(
  () => ({
    mockSessionCreate: vi.fn(),
    mockRefundsCreate: vi.fn(),
    mockConstructEvent: vi.fn(),
  })
);

vi.mock('#/utils/logger.server', () => ({
  default: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(function () {
    return {
      checkout: {
        sessions: {
          create: mockSessionCreate,
        },
      },
      refunds: {
        create: mockRefundsCreate,
      },
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    };
  });
  return { default: MockStripe };
});

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

import {
  _registry,
  createPaymentSession,
  getProvider,
  registerProvider,
} from '#/core/payments/index.server';
import { stripeProvider } from '#/core/payments/stripe.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCart({
  currency = 'USD',
  lines = [{ priceCentsSnapshot: 1999, titleSnapshot: 'Widget', quantity: 2 }],
} = {}) {
  return { currency, lines };
}

function makeRequest({ signature = 'sig_test', body = '{"id":"evt_1"}' } = {}) {
  return {
    headers: {
      get: vi.fn((name) => {
        if (name === 'stripe-signature') return signature;
        return null;
      }),
    },
    text: vi.fn().mockResolvedValue(body),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('payment registry', () => {
  beforeEach(() => {
    // Clear registry between tests to avoid state leakage.
    _registry.clear();
    vi.clearAllMocks();
  });

  it('registerProvider + getProvider returns the same provider object', () => {
    const provider = { createCheckoutSession: vi.fn() };
    registerProvider('test', provider);
    expect(getProvider('test')).toBe(provider);
  });

  it('getProvider throws for an unknown provider id', () => {
    expect(() => getProvider('nonexistent')).toThrow(
      'Payment provider "nonexistent" is not registered'
    );
  });

  it('createPaymentSession delegates to the registered provider', async () => {
    const fakeSession = { id: 'cs_fake', url: 'https://pay.example/cs_fake' };
    const provider = {
      createCheckoutSession: vi.fn().mockResolvedValue(fakeSession),
    };
    registerProvider('fake', provider);

    const params = { cart: makeCart(), successUrl: '/ok', cancelUrl: '/no' };
    const result = await createPaymentSession('fake', params);

    expect(provider.createCheckoutSession).toHaveBeenCalledOnce();
    expect(provider.createCheckoutSession).toHaveBeenCalledWith(params);
    expect(result).toBe(fakeSession);
  });
});

describe('stripeProvider.createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCreate.mockResolvedValue({
      id: 'cs_stripe_123',
      url: 'https://checkout.stripe.com/cs_stripe_123',
    });
  });

  it('builds line_items with lowercase currency and unit_amount from priceCentsSnapshot', async () => {
    const cart = makeCart({
      currency: 'EUR',
      lines: [
        { priceCentsSnapshot: 4999, titleSnapshot: 'T-Shirt', quantity: 1 },
        { priceCentsSnapshot: 999, titleSnapshot: 'Sticker', quantity: 3 },
      ],
    });

    const result = await stripeProvider.createCheckoutSession({
      cart,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(mockSessionCreate).toHaveBeenCalledOnce();
    const [args] = mockSessionCreate.mock.calls;
    expect(args[0].mode).toBe('payment');
    expect(args[0].success_url).toBe('https://example.com/success');
    expect(args[0].cancel_url).toBe('https://example.com/cancel');
    expect(args[0].line_items).toEqual([
      {
        price_data: {
          currency: 'eur',
          unit_amount: 4999,
          product_data: { name: 'T-Shirt' },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'eur',
          unit_amount: 999,
          product_data: { name: 'Sticker' },
        },
        quantity: 3,
      },
    ]);
    expect(result).toEqual({
      id: 'cs_stripe_123',
      url: 'https://checkout.stripe.com/cs_stripe_123',
    });
  });

  it('uses a single order-total line item when amountCents differs from cart subtotal', async () => {
    const cart = makeCart({
      currency: 'USD',
      lines: [
        { priceCentsSnapshot: 2000, titleSnapshot: 'Widget', quantity: 1 },
      ],
    });

    await stripeProvider.createCheckoutSession({
      cart,
      amountCents: 2700,
      currency: 'USD',
      successUrl: '/ok',
      cancelUrl: '/no',
    });

    const [args] = mockSessionCreate.mock.calls;
    expect(args[0].line_items).toEqual([
      {
        price_data: {
          currency: 'usd',
          unit_amount: 2700,
          product_data: { name: 'Order total' },
        },
        quantity: 1,
      },
    ]);
  });

  it('lowercases the currency from the cart', async () => {
    const cart = makeCart({ currency: 'GBP' });
    await stripeProvider.createCheckoutSession({
      cart,
      successUrl: '/ok',
      cancelUrl: '/no',
    });

    const [args] = mockSessionCreate.mock.calls;
    expect(args[0].line_items[0].price_data.currency).toBe('gbp');
  });
});

describe('stripeProvider.verifyWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls constructEvent with raw body and returns { event, rawBody }', async () => {
    const fakeEvent = { id: 'evt_abc', type: 'checkout.session.completed' };
    mockConstructEvent.mockReturnValue(fakeEvent);

    const rawBody = '{"id":"evt_abc"}';
    const req = makeRequest({ signature: 'sig_real', body: rawBody });

    const result = await stripeProvider.verifyWebhook(req);

    expect(mockConstructEvent).toHaveBeenCalledOnce();
    const [calledBody, calledSig] = mockConstructEvent.mock.calls[0];
    expect(calledBody).toBe(rawBody);
    expect(calledSig).toBe('sig_real');
    expect(result.event).toBe(fakeEvent);
    expect(result.rawBody).toBe(rawBody);
  });

  it('throws when stripe-signature header is missing', async () => {
    const req = makeRequest({ signature: null });

    await expect(stripeProvider.verifyWebhook(req)).rejects.toThrow(
      'Missing stripe-signature header'
    );
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });
});

describe('stripeProvider.createRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls stripe.refunds.create and returns { refundId, status }', async () => {
    mockRefundsCreate.mockResolvedValue({ id: 're_123', status: 'succeeded' });

    const result = await stripeProvider.createRefund({
      paymentIntentId: 'pi_abc',
      amountCents: 500,
      reason: 'requested_by_customer',
    });

    expect(mockRefundsCreate).toHaveBeenCalledOnce();
    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_abc',
      amount: 500,
      reason: 'requested_by_customer',
    });
    expect(result).toEqual({ refundId: 're_123', status: 'succeeded' });
  });
});

describe('stripeProvider.handleWebhookEvent', () => {
  it('returns type payment.succeeded for payment_intent.succeeded', async () => {
    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_xyz',
          amount: 2000,
          metadata: { orderId: 'ord_1' },
        },
      },
    };

    const result = await stripeProvider.handleWebhookEvent(event);

    expect(result.type).toBe('payment.succeeded');
    expect(result.orderId).toBe('ord_1');
    expect(result.amount).toBe(2000);
  });

  it('returns type payment.other for unhandled event types', async () => {
    const event = { type: 'customer.created', data: { object: {} } };
    const result = await stripeProvider.handleWebhookEvent(event);
    expect(result).toEqual({ type: 'payment.other' });
  });
});
