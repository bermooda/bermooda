// app/routes/webhooks/webhook.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — available inside vi.mock factory functions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import { action } from './$provider.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method = 'POST') {
  return new Request('http://localhost/webhooks/stripe', { method });
}

function makeParams(provider = 'stripe') {
  return { provider };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('webhook dispatcher — action()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: emit resolves
    mockEmit.mockResolvedValue(undefined);
  });

  // 1. Unknown provider → 404
  it('returns 404 for an unknown provider', async () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error('Payment provider "unknown" is not registered');
    });

    const res = await action({
      request: makeRequest(),
      params: makeParams('unknown'),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unknown provider' });
  });

  // 2. Duplicate eventId → 200 with duplicate flag
  it('returns 200 with duplicate:true when the event has already been processed', async () => {
    const fakeEvent = { id: 'evt_dup', type: 'payment_intent.succeeded' };
    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockResolvedValue({
        event: fakeEvent,
        rawBody: '{"id":"evt_dup"}',
      }),
    });
    // Simulate existing record
    mockFindUnique.mockResolvedValue({
      provider: 'stripe',
      eventId: 'evt_dup',
    });

    const res = await action({
      request: makeRequest(),
      params: makeParams('stripe'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, duplicate: true });
    // Must NOT write a new record or emit
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  // 3. Valid webhook → creates WebhookEvent + emits domain event
  it('creates a WebhookEvent and emits the domain event for a valid webhook', async () => {
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
    mockFindUnique.mockResolvedValue(null); // not a duplicate
    mockCreate.mockResolvedValue({});

    const res = await action({
      request: makeRequest(),
      params: makeParams('stripe'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    // WebhookEvent created with correct data
    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0].data;
    expect(createArg.provider).toBe('stripe');
    expect(createArg.eventId).toBe('evt_new');
    expect(createArg.type).toBe('payment_intent.succeeded');
    expect(createArg.payload).toBe(rawBody);
    expect(createArg.processedAt).toBeInstanceOf(Date);

    // Domain event emitted
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith('payment.succeeded', domainResult);
  });

  // 4. Verification failure → 400
  it('returns 400 when webhook verification fails', async () => {
    mockGetProvider.mockReturnValue({
      verifyWebhook: vi.fn().mockRejectedValue(new Error('Invalid signature')),
    });

    const res = await action({
      request: makeRequest(),
      params: makeParams('stripe'),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Webhook verification failed' });
    // Nothing written to DB
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // 5. Non-POST method → 405
  it('returns 405 for a non-POST request', async () => {
    const res = await action({
      request: makeRequest('GET'),
      params: makeParams('stripe'),
    });

    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body).toEqual({ error: 'Method not allowed' });
    // Provider registry should not even be queried
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  // 6. DB / processing error → 400 with error message
  it('returns 400 with error message when a processing error occurs', async () => {
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

    const res = await action({
      request: makeRequest(),
      params: makeParams('stripe'),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'DB exploded' });
  });

  // 7. Provider lookup uses params.provider
  it('passes params.provider to getProvider', async () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error('not found');
    });

    await action({ request: makeRequest(), params: makeParams('paypal') });

    expect(mockGetProvider).toHaveBeenCalledWith('paypal');
  });
});
