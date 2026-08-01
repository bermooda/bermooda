import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/libs/api/public/index.server', () => ({
  parseJsonBody: vi.fn(),
  requireMethod: vi.fn().mockReturnValue(null),
}));

vi.mock('#/core/cart/index.server', () => ({
  createCart: vi.fn(),
}));

vi.mock('#/core/channels/index.server', () => ({
  resolveChannelFromRequest: vi.fn(),
}));

import { parseJsonBody } from '#/libs/api/public/index.server';
import { createCart } from '#/core/cart/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';

import { action } from '#/routes/api/v1/cart';

describe('POST /api/v1/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveChannelFromRequest.mockResolvedValue({ id: 'ch_api' });
    parseJsonBody.mockResolvedValue({
      body: { currency: 'EUR' },
      error: null,
    });
    createCart.mockResolvedValue({
      id: 'cart_1',
      token: 'tok_1',
      currency: 'EUR',
      salesChannelId: 'ch_api',
    });
  });

  it('resolves channel from request and passes salesChannelId', async () => {
    const request = new Request('http://shop.example/api/v1/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'EUR' }),
    });

    const response = await action({ request });
    expect(response.status).toBe(201);
    expect(resolveChannelFromRequest).toHaveBeenCalledWith(request);
    expect(createCart).toHaveBeenCalledWith({
      currency: 'EUR',
      customerId: undefined,
      salesChannelId: 'ch_api',
    });
  });
});
