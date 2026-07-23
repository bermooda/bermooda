// app/core/payments/inbound.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProvider, mockEmit, mockFindUnique, mockCreate } = vi.hoisted(
  () => ({
    mockGetProvider: vi.fn(),
    mockEmit: vi.fn(),
    mockFindUnique: vi.fn(),
    mockCreate: vi.fn(),
  })
);

vi.mock('#/core/payments/index.server', () => ({
  getProvider: mockGetProvider,
}));

vi.mock('#/core/events/index.server', () => ({
  emit: mockEmit,
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    webhookEvent: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  normalizeWebhookEventType,
  processPaymentProviderWebhook,
  resolvePaymentProvider,
} from './index.server';

function makeRequest() {
  return new Request('http://localhost/webhooks/stripe', { method: 'POST' });
}

describe('resolvePaymentProvider', () => {
  it('returns the provider when registered', () => {
    const provider = { verifyWebhook: vi.fn() };
    mockGetProvider.mockReturnValue(provider);
    expect(resolvePaymentProvider('stripe')).toBe(provider);
  });

  it('throws PROVIDER_NOT_FOUND for unknown providers', () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error('Payment provider "unknown" is not registered');
    });
    expect(() => resolvePaymentProvider('unknown')).toThrow(
      expect.objectContaining({ code: 'PROVIDER_NOT_FOUND', status: 404 })
    );
  });
});

describe('normalizeWebhookEventType', () => {
  it('prefers type, then event_type, then unknown', () => {
    expect(
      normalizeWebhookEventType({ type: 'payment_intent.succeeded' })
    ).toBe('payment_intent.succeeded');
    expect(
      normalizeWebhookEventType({ event_type: 'CHECKOUT.ORDER.APPROVED' })
    ).toBe('CHECKOUT.ORDER.APPROVED');
    expect(normalizeWebhookEventType({ id: 'evt_1' })).toBe('unknown');
  });
});

describe('processPaymentProviderWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockResolvedValue(undefined);
  });

  it('returns duplicate when the event was already processed', async () => {
    const fakeEvent = { id: 'evt_dup', type: 'payment_intent.succeeded' };
    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockResolvedValue({
        event: fakeEvent,
        rawBody: '{"id":"evt_dup"}',
      }),
    });
    mockFindUnique.mockResolvedValue({
      provider: 'stripe',
      eventId: 'evt_dup',
    });

    const result = await processPaymentProviderWebhook('stripe', makeRequest());

    expect(result).toEqual({ received: true, duplicate: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('persists the event and emits the domain result', async () => {
    const fakeEvent = { id: 'evt_new', type: 'payment_intent.succeeded' };
    const rawBody = '{"id":"evt_new"}';
    const domainResult = {
      type: 'payment.succeeded',
      orderId: 'ord_1',
      amount: 2000,
    };

    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockResolvedValue({ event: fakeEvent, rawBody }),
      handleWebhookEvent: vi.fn().mockResolvedValue(domainResult),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    const result = await processPaymentProviderWebhook('stripe', makeRequest());

    expect(result).toEqual({ received: true });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      provider: 'stripe',
      eventId: 'evt_new',
      type: 'payment_intent.succeeded',
      payload: rawBody,
    });
    expect(mockEmit).toHaveBeenCalledWith('payment.succeeded', domainResult);
  });

  it('throws VERIFICATION_FAILED when signature verification fails', async () => {
    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockRejectedValue(new Error('Invalid signature')),
    });

    await expect(
      processPaymentProviderWebhook('stripe', makeRequest())
    ).rejects.toMatchObject({
      code: 'VERIFICATION_FAILED',
      status: 400,
      message: 'Webhook verification failed',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('propagates processing errors from handleWebhookEvent', async () => {
    const fakeEvent = { id: 'evt_err', type: 'some.event' };
    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockResolvedValue({
        event: fakeEvent,
        rawBody: '{}',
      }),
      handleWebhookEvent: vi.fn().mockRejectedValue(new Error('DB exploded')),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    await expect(
      processPaymentProviderWebhook('stripe', makeRequest())
    ).rejects.toThrow('DB exploded');
  });
});
