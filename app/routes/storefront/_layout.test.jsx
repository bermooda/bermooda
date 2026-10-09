import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/auth/customer/index.server', () => ({
  getCustomerSession: vi.fn(),
}));
vi.mock('#/core/channels/index.server', () => ({
  resolveChannelFromRequest: vi.fn().mockResolvedValue({
    id: 'ch_1',
    handle: 'default',
    name: 'Default',
    locale: 'en',
  }),
}));
vi.mock('#/core/content/index.server', () => ({
  getMenuByHandle: vi.fn().mockResolvedValue(null),
}));
vi.mock('#/core/currency/index.server', () => ({
  getRequestCurrency: vi.fn().mockResolvedValue('USD'),
}));
vi.mock('#/core/i18n/index.server', () => ({
  loadStorefrontMessages: vi.fn().mockResolvedValue({}),
  resolveLocale: vi.fn().mockResolvedValue('en'),
}));
vi.mock('#/core/loyalty/index.server', () => ({
  normalizeReferralCode: (code) => code.trim().toUpperCase(),
  settleReferral: vi.fn(),
}));
vi.mock('#/core/settings/index.server', () => ({
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD']),
  getEnabledLocales: vi.fn().mockResolvedValue(['en']),
}));
vi.mock('#/core/themes/index.server', () => ({
  getSlotBlocksMap: vi.fn().mockResolvedValue({}),
}));

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { settleReferral } from '#/core/loyalty/index.server';

import { loader } from '#/routes/storefront/_layout';

function request(url = 'http://localhost/', cookie = '') {
  return new Request(url, { headers: cookie ? { cookie } : {} });
}

describe('storefront layout loader referral cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerSession.mockResolvedValue(null);
  });

  it('survives a malformed referral cookie', async () => {
    const response = await loader({
      request: request('http://localhost/', 'bermooda_ref=%E0%A4%A'),
    });

    expect(response.status).toBe(200);
    expect(settleReferral).not.toHaveBeenCalled();
  });

  it('stores a ?ref code for guests in an HttpOnly cookie', async () => {
    const response = await loader({
      request: request('http://localhost/?ref=summer'),
    });

    expect(response.headers.get('Set-Cookie')).toContain(
      'bermooda_ref=SUMMER; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly'
    );
  });

  it('clears the cookie once a signed-in referral is settled', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    settleReferral.mockResolvedValue(true);

    const response = await loader({
      request: request('http://localhost/', 'bermooda_ref=SUMMER'),
    });

    expect(settleReferral).toHaveBeenCalledWith('SUMMER', 'cust_1');
    expect(response.headers.get('Set-Cookie')).toContain(
      'bermooda_ref=; Path=/; Max-Age=0'
    );
  });

  it('keeps the cookie when tracking should retry', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    settleReferral.mockResolvedValue(false);

    const response = await loader({
      request: request('http://localhost/', 'bermooda_ref=SUMMER'),
    });

    expect(response.headers.get('Set-Cookie') ?? '').not.toContain(
      'bermooda_ref'
    );
  });
});
