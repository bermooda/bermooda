import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/gift-cards/index.server', async (importOriginal) => ({
  ...(await importOriginal()),
  issueGiftCard: vi.fn(),
}));

vi.mock('#/core/settings/index.server', async (importOriginal) => ({
  ...(await importOriginal()),
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD', 'JPY']),
  get: vi.fn().mockResolvedValue('USD'),
}));

import { issueGiftCard } from '#/core/gift-cards/index.server';

import { action, loader } from '#/routes/admin/gift-cards/new';

function issueRequest(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request('http://localhost/admin/gift-cards/new', {
    method: 'POST',
    body: form,
  });
}

describe('admin new gift card route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads enabled currencies and the shop default', async () => {
    expect(await loader()).toEqual({
      currencies: ['USD', 'JPY'],
      defaultCurrency: 'USD',
    });
  });

  it('converts the decimal balance to cents', async () => {
    issueGiftCard.mockResolvedValue({ id: 'gc_1' });

    const response = await action({
      request: issueRequest({ balance: '25.50', currency: 'USD' }),
    });

    expect(response.status).toBe(302);
    expect(issueGiftCard).toHaveBeenCalledWith(
      expect.objectContaining({ balanceCents: 2550, currency: 'USD' })
    );
  });

  it('rejects sub-unit amounts in zero-decimal currencies', async () => {
    const result = await action({
      request: issueRequest({ balance: '10.50', currency: 'JPY' }),
    });

    expect(result.error).toBe('Balance must be a whole amount in JPY.');
    expect(issueGiftCard).not.toHaveBeenCalled();
  });

  it('rejects a missing balance', async () => {
    const result = await action({
      request: issueRequest({ balance: '', currency: 'USD' }),
    });

    expect(result.error).toBe('Balance must be greater than zero.');
  });
});
