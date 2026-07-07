import { describe, expect, it } from 'vitest';

import {
  cartNotFoundResponse,
  jsonDomainError,
  methodNotAllowedResponse,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public.server';

describe('requireMethod', () => {
  it('returns null when the method matches', () => {
    const request = new Request('http://localhost/api/v1/cart', {
      method: 'POST',
    });
    expect(requireMethod(request, 'POST')).toBeNull();
  });

  it('returns 405 when the method does not match', async () => {
    const request = new Request('http://localhost/api/v1/cart', {
      method: 'GET',
    });
    const response = requireMethod(request, 'POST');
    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toEqual({
      error: 'Method not allowed',
    });
  });
});

describe('parseJsonBody', () => {
  it('parses a JSON object body', async () => {
    const request = new Request('http://localhost/api/v1/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'EUR' }),
    });

    const result = await parseJsonBody(request);
    expect(result).toEqual({ body: { currency: 'EUR' } });
  });

  it('returns a default value when JSON parsing fails', async () => {
    const request = new Request('http://localhost/api/v1/cart', {
      method: 'POST',
      body: 'not-json',
    });

    const result = await parseJsonBody(request, { defaultValue: {} });
    expect(result).toEqual({ body: {} });
  });

  it('returns 400 when JSON parsing fails without a default', async () => {
    const request = new Request('http://localhost/api/v1/cart', {
      method: 'POST',
      body: 'not-json',
    });

    const result = await parseJsonBody(request);
    expect(result.error?.status).toBe(400);
  });
});

describe('jsonDomainError', () => {
  it('uses err.status when present', () => {
    const err = Object.assign(new Error('Cart not found'), {
      code: 'CART_NOT_FOUND',
      status: 404,
    });
    const response = jsonDomainError(err);
    expect(response.status).toBe(404);
  });

  it('falls back to the default status', () => {
    const err = Object.assign(new Error('Invalid quantity'), {
      code: 'INVALID_QUANTITY',
    });
    const response = jsonDomainError(err);
    expect(response.status).toBe(422);
  });
});

describe('methodNotAllowedResponse', () => {
  it('returns a 405 JSON payload', async () => {
    const response = methodNotAllowedResponse();
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: 'Method not allowed',
    });
  });
});

describe('cartNotFoundResponse', () => {
  it('returns a 404 JSON payload', async () => {
    const response = cartNotFoundResponse();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Cart not found',
    });
  });
});
