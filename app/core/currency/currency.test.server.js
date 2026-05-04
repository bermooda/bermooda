// app/core/currency/currency.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: { variantPrice: { findUnique: vi.fn() } },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
}));

// Import after mocks are registered
import prisma from '#/libs/prisma.server';

import {
  getRequestCurrency,
  lookupVariantPrice,
  lookupVariantPriceForBrowsing,
  formatPrice,
  setCurrencyCookie,
} from '#/core/currency/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

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
});

// ---------------------------------------------------------------------------
// lookupVariantPrice
// ---------------------------------------------------------------------------

describe('lookupVariantPrice', () => {
  it('returns price data on exact match', async () => {
    prisma.variantPrice.findUnique.mockResolvedValueOnce({
      priceCents: 1999,
      compareAtCents: 2499,
      currency: 'USD',
    });

    const result = await lookupVariantPrice('var_1', 'USD');

    expect(result).toEqual({
      priceCents: 1999,
      compareAtCents: 2499,
      currency: 'USD',
    });
    expect(prisma.variantPrice.findUnique).toHaveBeenCalledWith({
      where: { variantId_currency: { variantId: 'var_1', currency: 'USD' } },
    });
  });

  it('returns null when no row is found', async () => {
    prisma.variantPrice.findUnique.mockResolvedValueOnce(null);
    const result = await lookupVariantPrice('var_1', 'EUR');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// lookupVariantPriceForBrowsing
// ---------------------------------------------------------------------------

describe('lookupVariantPriceForBrowsing', () => {
  it('returns exact price with isFallback: false when found', async () => {
    prisma.variantPrice.findUnique.mockResolvedValueOnce({
      priceCents: 999,
      compareAtCents: null,
      currency: 'EUR',
    });

    const result = await lookupVariantPriceForBrowsing('var_2', 'EUR');

    expect(result).toEqual({
      priceCents: 999,
      compareAtCents: null,
      currency: 'EUR',
      isFallback: false,
    });
  });

  it('returns fallback price with isFallback: true when exact not found', async () => {
    // First call: exact miss; second call: fallback hit
    prisma.variantPrice.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        priceCents: 1499,
        compareAtCents: null,
        currency: 'USD',
      });

    settingsGet.mockResolvedValueOnce('USD');

    const result = await lookupVariantPriceForBrowsing('var_3', 'EUR');

    expect(result).toEqual({
      priceCents: 1499,
      compareAtCents: null,
      currency: 'USD',
      isFallback: true,
    });
  });

  it('returns null when neither exact nor fallback found', async () => {
    prisma.variantPrice.findUnique.mockResolvedValue(null);
    settingsGet.mockResolvedValueOnce('USD');

    const result = await lookupVariantPriceForBrowsing('var_4', 'EUR');

    expect(result).toBeNull();
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
});

// ---------------------------------------------------------------------------
// setCurrencyCookie
// ---------------------------------------------------------------------------

describe('setCurrencyCookie', () => {
  it('sets the correct Set-Cookie header', () => {
    const res = makeResponse();
    setCurrencyCookie(res, 'USD');
    expect(res.headers.get('Set-Cookie')).toBe(
      'currency=USD; Path=/; SameSite=Lax'
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
