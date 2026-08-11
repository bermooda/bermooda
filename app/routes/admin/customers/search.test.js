import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuthenticate, mockListCustomers } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockListCustomers: vi.fn(),
}));

vi.mock('#/libs/auth/admin/index.server', () => ({
  authenticate: mockAuthenticate,
}));

vi.mock('#/core/customers/index.server', () => ({
  listCustomers: mockListCustomers,
}));

import { loader } from '#/routes/admin/customers/search';

describe('admin customers search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({ user: { id: 'admin-1' } });
    mockListCustomers.mockResolvedValue({ customers: [], total: 0 });
  });

  it('requires an admin session and returns matching customers', async () => {
    mockListCustomers.mockResolvedValue({
      customers: [
        { id: 'c1', email: 'a@example.com', name: 'Alice' },
        { id: 'c2', email: 'b@example.com', name: null },
      ],
      total: 2,
    });

    const response = await loader({
      request: new Request(
        'http://localhost/admin/customers/search?q=ali&limit=10'
      ),
    });
    const body = await response.json();

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(mockListCustomers).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      q: 'ali',
    });
    expect(body).toEqual({
      customers: [
        { id: 'c1', email: 'a@example.com', name: 'Alice' },
        { id: 'c2', email: 'b@example.com', name: null },
      ],
    });
  });

  it('omits excluded customer ids from the response', async () => {
    mockListCustomers.mockResolvedValue({
      customers: [
        { id: 'c1', email: 'a@example.com', name: 'Alice' },
        { id: 'c2', email: 'b@example.com', name: 'Bob' },
        { id: 'c3', email: 'c@example.com', name: 'Cara' },
      ],
      total: 3,
    });

    const response = await loader({
      request: new Request(
        'http://localhost/admin/customers/search?exclude=c2&exclude=c3&limit=20'
      ),
    });
    const body = await response.json();

    expect(body.customers).toEqual([
      { id: 'c1', email: 'a@example.com', name: 'Alice' },
    ]);
    expect(mockListCustomers).toHaveBeenCalledWith({
      page: 1,
      limit: 22,
      q: undefined,
    });
  });
});
