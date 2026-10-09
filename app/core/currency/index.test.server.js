// app/core/currency/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/core/channels/index.server', () => ({
  resolveChannelFromRequest: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  DEFAULT_CURRENCY: 'USD',
  SETTING_KEYS: { DEFAULT_CURRENCY: 'defaultCurrency' },
  get: vi.fn(),
  getEnabledCurrencies: vi.fn(),
}));

// Import after mocks are registered
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import {
  centsPerMinorUnit,
  centsToInputValue,
  centsToMajorUnitString,
  centsToMinorUnits,
  currencyFractionDigits,
  currencyInputStep,
  formatPrice,
  isCentsAtCurrencyPrecision,
  roundCentsToCurrency,
} from '#/core/currency/format';
import {
  getRequestCurrency,
  setCurrencyCookie,
} from '#/core/currency/index.server';
import {
  getEnabledCurrencies,
  get as settingsGet,
} from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(cookieHeader = '') {
  return new Request('http://localhost/', {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

function makeResponse() {
  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  getEnabledCurrencies.mockResolvedValue(['USD', 'EUR', 'GBP']);
  resolveChannelFromRequest.mockResolvedValue({
    isDefault: true,
    currency: 'USD',
  });
});

// ---------------------------------------------------------------------------
// getRequestCurrency
// ---------------------------------------------------------------------------

describe('getRequestCurrency', () => {
  it('returns the currency from the currency cookie', async () => {
    const req = makeRequest('currency=EUR');
    const result = await getRequestCurrency(req);
    expect(result).toBe('EUR');
  });

  it('falls back to defaultCurrency setting when no cookie is present', async () => {
    settingsGet.mockResolvedValueOnce('GBP');
    const req = makeRequest();
    const result = await getRequestCurrency(req);
    expect(result).toBe('GBP');
    expect(settingsGet).toHaveBeenCalledWith('defaultCurrency');
  });

  it("falls back to 'USD' when no cookie and no setting", async () => {
    settingsGet.mockResolvedValueOnce(null);
    const req = makeRequest();
    const result = await getRequestCurrency(req);
    expect(result).toBe('USD');
  });

  it('ignores invalid cookie values and falls back to settings', async () => {
    settingsGet.mockResolvedValueOnce('EUR');
    // lowercase 'usd' — fails /^[A-Z]{3}$/ guard
    const req1 = makeRequest('currency=usd');
    expect(await getRequestCurrency(req1)).toBe('EUR');

    settingsGet.mockResolvedValueOnce('GBP');
    // too long — fails guard
    const req2 = makeRequest('currency=TOOLONG');
    expect(await getRequestCurrency(req2)).toBe('GBP');
  });

  it('ignores a well-formed cookie for a currency that is not enabled', async () => {
    settingsGet.mockResolvedValueOnce('USD');
    const req = makeRequest('currency=JPY');
    expect(await getRequestCurrency(req)).toBe('USD');
  });

  it('uses a non-default channel currency when there is no cookie', async () => {
    resolveChannelFromRequest.mockResolvedValueOnce({
      isDefault: false,
      currency: 'EUR',
    });
    expect(await getRequestCurrency(makeRequest())).toBe('EUR');
    expect(settingsGet).not.toHaveBeenCalled();
  });

  it('prefers the cookie over the channel currency', async () => {
    resolveChannelFromRequest.mockResolvedValueOnce({
      isDefault: false,
      currency: 'EUR',
    });
    expect(await getRequestCurrency(makeRequest('currency=GBP'))).toBe('GBP');
  });

  it('lets the default channel defer to the defaultCurrency setting', async () => {
    resolveChannelFromRequest.mockResolvedValueOnce({
      isDefault: true,
      currency: 'USD',
    });
    settingsGet.mockResolvedValueOnce('EUR');
    expect(await getRequestCurrency(makeRequest())).toBe('EUR');
  });

  it('ignores a channel currency that is not enabled', async () => {
    resolveChannelFromRequest.mockResolvedValueOnce({
      isDefault: false,
      currency: 'JPY',
    });
    settingsGet.mockResolvedValueOnce('USD');
    expect(await getRequestCurrency(makeRequest())).toBe('USD');
  });

  it('does not match cookies whose name only ends in currency', async () => {
    settingsGet.mockResolvedValueOnce('USD');
    const req = makeRequest('xcurrency=EUR');
    expect(await getRequestCurrency(req)).toBe('USD');
  });
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('formats USD cents correctly', () => {
    expect(formatPrice(1999, 'USD', 'en')).toBe('$19.99');
  });

  it('formats EUR correctly with locale', () => {
    // de-DE uses comma decimal separator: 19,99 €
    const result = formatPrice(1999, 'EUR', 'de-DE');
    expect(result).toMatch(/19[,.]99/);
    expect(result).toMatch(/EUR|€/);
  });

  it('uses the currency precision', () => {
    expect(formatPrice(100000, 'JPY', 'en')).toBe('¥1,000');
    expect(formatPrice(1234, 'KWD', 'en')).toMatch(/^KWD\s12\.340$/);
  });

  it('reuses formatters across calls', () => {
    expect(formatPrice(500, 'GBP', 'en')).toBe('£5.00');
    expect(formatPrice(750, 'GBP', 'en')).toBe('£7.50');
  });
});

// ---------------------------------------------------------------------------
// Provider minor units
// ---------------------------------------------------------------------------

describe('currencyFractionDigits', () => {
  it('returns ISO 4217 minor-unit digits', () => {
    expect(currencyFractionDigits('USD')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('KWD')).toBe(3);
  });
});

describe('centsToMinorUnits', () => {
  it('keeps two-decimal currencies unchanged', () => {
    expect(centsToMinorUnits(1999, 'USD')).toBe(1999);
  });

  it('converts zero-decimal currencies to whole units', () => {
    // ¥1,000.00 stored as 100000 cents → Stripe amount 1000
    expect(centsToMinorUnits(100000, 'JPY')).toBe(1000);
    expect(centsToMinorUnits(150, 'JPY')).toBe(2);
  });

  it('converts three-decimal currencies', () => {
    expect(centsToMinorUnits(1234, 'KWD')).toBe(12340);
  });
});

describe('centsToMajorUnitString', () => {
  it('uses the currency precision', () => {
    expect(centsToMajorUnitString(1999, 'USD')).toBe('19.99');
    expect(centsToMajorUnitString(100000, 'JPY')).toBe('1000');
    expect(centsToMajorUnitString(1234, 'KWD')).toBe('12.340');
  });
});

// ---------------------------------------------------------------------------
// setCurrencyCookie
// ---------------------------------------------------------------------------

describe('setCurrencyCookie', () => {
  it('sets the correct Set-Cookie header', () => {
    const res = makeResponse();
    setCurrencyCookie(res, 'USD');
    expect(res.headers.get('Set-Cookie')).toBe(
      'currency=USD; Path=/; SameSite=Lax; Max-Age=31536000'
    );
  });

  it('throws for invalid currency codes', () => {
    const res = makeResponse();
    expect(() => setCurrencyCookie(res, 'usd')).toThrow();
    expect(() => setCurrencyCookie(res, 'US')).toThrow();
    expect(() => setCurrencyCookie(res, 'USDD')).toThrow();
    expect(() => setCurrencyCookie(res, '')).toThrow();
  });
});

describe('currency precision helpers', () => {
  it('reports cents per smallest unit', () => {
    expect(centsPerMinorUnit('USD')).toBe(1);
    expect(centsPerMinorUnit('JPY')).toBe(100);
    expect(centsPerMinorUnit('KWD')).toBe(1);
  });

  it('rounds and checks cents against the currency precision', () => {
    expect(roundCentsToCurrency(150, 'JPY')).toBe(200);
    expect(roundCentsToCurrency(1999, 'USD')).toBe(1999);
    expect(isCentsAtCurrencyPrecision(150, 'JPY')).toBe(false);
    expect(isCentsAtCurrencyPrecision(100000, 'JPY')).toBe(true);
    expect(isCentsAtCurrencyPrecision(1999, 'USD')).toBe(true);
  });

  it('builds admin input step and value', () => {
    expect(currencyInputStep('USD')).toBe('0.01');
    expect(currencyInputStep('JPY')).toBe('1');
    expect(centsToInputValue(1999, 'USD')).toBe('19.99');
    expect(centsToInputValue(100000, 'JPY')).toBe('1000');
    expect(centsToInputValue(150, 'JPY')).toBe('2');
    expect(centsToInputValue(0, 'USD')).toBe('0.00');
  });
});
