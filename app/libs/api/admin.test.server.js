import { describe, expect, it } from 'vitest';

import {
  createDomainErrorMapper,
  jsonHookAbortError,
  jsonListResponse,
  jsonResourceOr404,
  parseAdminListPagination,
  parseBooleanQueryParam,
  parseOptionalJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import { HookAbortError } from '#/core/events/index.server';

describe('requireOneOfMethods', () => {
  it('returns null when the method is allowed', () => {
    const request = new Request('http://localhost/api/admin/v1/products/1', {
      method: 'PATCH',
    });
    expect(requireOneOfMethods(request, ['PATCH', 'DELETE'])).toBeNull();
  });

  it('returns 405 when the method is not allowed', async () => {
    const request = new Request('http://localhost/api/admin/v1/products/1', {
      method: 'GET',
    });
    const response = requireOneOfMethods(request, ['PATCH', 'DELETE']);
    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toEqual({
      error: 'Method not allowed',
    });
  });
});

describe('parseOptionalJsonBody', () => {
  it('returns the default value for empty bodies', async () => {
    const request = new Request(
      'http://localhost/api/admin/v1/returns/1/approve',
      {
        method: 'POST',
        headers: { 'content-length': '0' },
      }
    );

    const result = await parseOptionalJsonBody(request);
    expect(result).toEqual({ body: {} });
  });

  it('parses a JSON object body', async () => {
    const request = new Request(
      'http://localhost/api/admin/v1/returns/1/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmountCents: 100 }),
      }
    );

    const result = await parseOptionalJsonBody(request);
    expect(result).toEqual({ body: { refundAmountCents: 100 } });
  });
});

describe('parseBooleanQueryParam', () => {
  it('returns undefined when the param is absent', () => {
    const params = new URLSearchParams('page=1');
    expect(parseBooleanQueryParam(params, 'published')).toBeUndefined();
  });

  it('returns true or false when the param is present', () => {
    expect(
      parseBooleanQueryParam(new URLSearchParams('published=true'), 'published')
    ).toBe(true);
    expect(
      parseBooleanQueryParam(
        new URLSearchParams('published=false'),
        'published'
      )
    ).toBe(false);
  });
});

describe('parseAdminListPagination', () => {
  it('uses the provided default limit', () => {
    const params = new URLSearchParams();
    expect(parseAdminListPagination(params, { limit: 50 })).toEqual({
      page: 1,
      limit: 50,
    });
  });
});

describe('jsonListResponse', () => {
  it('builds a standard paginated payload', async () => {
    const response = jsonListResponse('products', {
      items: [{ id: '1' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(response.json()).resolves.toEqual({
      products: [{ id: '1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});

describe('jsonResourceOr404', () => {
  it('returns 404 when the resource is missing', async () => {
    const response = jsonResourceOr404('product', null);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Product not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns the resource payload when present', async () => {
    const response = jsonResourceOr404('product', { id: '1' });
    await expect(response.json()).resolves.toEqual({ product: { id: '1' } });
  });
});

describe('createDomainErrorMapper', () => {
  it('maps known codes to status codes', () => {
    const mapDomainError = createDomainErrorMapper({
      notFound: ['NOT_FOUND'],
      badRequest: ['INVALID_INPUT'],
      conflict: ['DUPLICATE'],
    });

    const notFound = mapDomainError(
      Object.assign(new Error('Missing'), { code: 'NOT_FOUND' })
    );
    expect(notFound.status).toBe(404);

    const badRequest = mapDomainError(
      Object.assign(new Error('Bad input'), { code: 'INVALID_INPUT' })
    );
    expect(badRequest.status).toBe(400);

    const conflict = mapDomainError(
      Object.assign(new Error('Duplicate'), { code: 'DUPLICATE' })
    );
    expect(conflict.status).toBe(409);
  });
});

describe('jsonHookAbortError', () => {
  it('returns a hook veto payload', async () => {
    const err = new HookAbortError('Blocked by plugin', {
      code: 'HOOK_BLOCKED',
      pluginId: 'sample-plugin',
    });
    const response = jsonHookAbortError(err);

    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toEqual({
      error: 'Blocked by plugin',
      code: 'HOOK_BLOCKED',
      blockedBy: 'sample-plugin',
    });
  });

  it('returns null for non-hook errors', () => {
    const err = new Error('Regular failure');
    expect(jsonHookAbortError(err)).toBeNull();
  });
});
