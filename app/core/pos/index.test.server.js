// app/core/pos/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    posSession: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    posOrder: {
      create: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('#/core/inventory/index.server', () => ({
  listLocations: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { listLocations } from '#/core/inventory/index.server';
import {
  buildSessionWhere,
  closePosSession,
  createPosDraftOrder,
  getPosSession,
  listPosSessions,
  openPosSession,
  parseCloseSessionInput,
  parseCreateDraftOrderFromForm,
  parseCreateDraftOrderInput,
  parseOpenSessionInput,
  parseSessionListParams,
  serializePosOrder,
  serializeSession,
} from '#/core/pos/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseSessionListParams', () => {
  it('parses pagination and filters', () => {
    const params = parseSessionListParams(
      new URLSearchParams('page=2&limit=10&staffId=staff-1&status=open')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      staffId: 'staff-1',
      status: 'open',
    });
  });

  it('rejects invalid session status', () => {
    expect(() =>
      parseSessionListParams(new URLSearchParams('status=invalid'))
    ).toThrow('Invalid POS session status filter.');
  });
});

describe('buildSessionWhere', () => {
  it('builds filters for staff, location, and status', () => {
    expect(
      buildSessionWhere({
        staffId: 'staff-1',
        locationId: 'loc-1',
        status: 'open',
      })
    ).toEqual({
      staffId: 'staff-1',
      locationId: 'loc-1',
      status: 'open',
    });
  });
});

describe('parseOpenSessionInput', () => {
  it('requires staffId', () => {
    expect(() => parseOpenSessionInput({})).toThrow('staffId is required.');
  });

  it('normalizes optional locationId', () => {
    expect(
      parseOpenSessionInput({ staffId: 'staff-1', locationId: 'loc-1' })
    ).toEqual({
      staffId: 'staff-1',
      locationId: 'loc-1',
    });
  });
});

describe('parseCreateDraftOrderInput', () => {
  it('accepts sessionId alias and normalizes currency', () => {
    expect(
      parseCreateDraftOrderInput({
        sessionId: 'sess-1',
        totalCents: 1500,
        currency: 'eur',
      })
    ).toEqual({
      posSessionId: 'sess-1',
      totalCents: 1500,
      currency: 'EUR',
    });
  });

  it('rejects negative totals', () => {
    expect(() =>
      parseCreateDraftOrderInput({ sessionId: 'sess-1', totalCents: -1 })
    ).toThrow('totalCents must be a non-negative integer.');
  });
});

describe('parseCreateDraftOrderFromForm', () => {
  it('parses form fields', () => {
    const formData = new FormData();
    formData.set('sessionId', 'sess-1');
    formData.set('totalCents', '2500');
    formData.set('currency', 'usd');

    expect(parseCreateDraftOrderFromForm(formData)).toEqual({
      posSessionId: 'sess-1',
      totalCents: 2500,
      currency: 'USD',
    });
  });
});

describe('serializeSession', () => {
  it('includes order count and nested orders', () => {
    const serialized = serializeSession({
      id: 'sess-1',
      staffId: 'staff-1',
      locationId: null,
      status: 'open',
      openedAt: new Date('2026-01-01'),
      closedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      location: null,
      staff: { id: 'staff-1', name: 'Alex', email: 'alex@example.com' },
      orders: [
        {
          id: 'order-1',
          posSessionId: 'sess-1',
          orderId: null,
          status: 'draft',
          totalCents: 0,
          currency: 'USD',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
    });

    expect(serialized.orderCount).toBe(1);
    expect(serialized.orders).toHaveLength(1);
    expect(serialized.orders[0].status).toBe('draft');
  });
});

describe('listPosSessions', () => {
  it('returns paginated serialized sessions', async () => {
    prisma.posSession.findMany.mockResolvedValue([
      {
        id: 'sess-1',
        staffId: 'staff-1',
        locationId: null,
        status: 'open',
        openedAt: new Date('2026-01-01'),
        closedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        location: null,
        staff: { id: 'staff-1', name: 'Alex', email: 'alex@example.com' },
        orders: [],
      },
    ]);
    prisma.posSession.count.mockResolvedValue(1);

    const result = await listPosSessions({ page: 1, limit: 20 });

    expect(result.sessions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});

describe('getPosSession', () => {
  it('throws when session is missing', async () => {
    prisma.posSession.findUnique.mockResolvedValue(null);

    await expect(getPosSession('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('openPosSession', () => {
  it('rejects duplicate open sessions for the same staff member', async () => {
    prisma.location.findUnique.mockResolvedValue({ id: 'loc-1' });
    prisma.posSession.findFirst.mockResolvedValue({ id: 'sess-open' });

    await expect(
      openPosSession({ staffId: 'staff-1', locationId: 'loc-1' })
    ).rejects.toMatchObject({
      code: 'SESSION_ALREADY_OPEN',
    });
  });

  it('creates a session when staff has no open session', async () => {
    prisma.posSession.findFirst.mockResolvedValue(null);
    prisma.posSession.create.mockResolvedValue({
      id: 'sess-1',
      staffId: 'staff-1',
      locationId: null,
      status: 'open',
      openedAt: new Date('2026-01-01'),
      closedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      location: null,
      staff: { id: 'staff-1', name: 'Alex', email: 'alex@example.com' },
      orders: [],
    });

    const session = await openPosSession({ staffId: 'staff-1' });

    expect(session.id).toBe('sess-1');
    expect(prisma.posSession.create).toHaveBeenCalled();
  });
});

describe('closePosSession', () => {
  it('requires an open session', async () => {
    prisma.posSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'closed',
      orders: [],
    });

    await expect(
      closePosSession(parseCloseSessionInput({ sessionId: 'sess-1' }))
    ).rejects.toMatchObject({
      code: 'SESSION_NOT_OPEN',
    });
  });
});

describe('createPosDraftOrder', () => {
  it('creates a draft order for an open session', async () => {
    prisma.posSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'open',
      orders: [],
    });
    prisma.posOrder.create.mockResolvedValue({
      id: 'pos-order-1',
      posSessionId: 'sess-1',
      orderId: null,
      status: 'draft',
      totalCents: 0,
      currency: 'USD',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    const order = await createPosDraftOrder({
      sessionId: 'sess-1',
      totalCents: 0,
      currency: 'USD',
    });

    expect(serializePosOrder(order).status).toBe('draft');
    expect(prisma.posOrder.create).toHaveBeenCalledWith({
      data: {
        posSessionId: 'sess-1',
        status: 'draft',
        currency: 'USD',
        totalCents: 0,
      },
    });
  });
});

describe('loadPosAdminIndexData dependencies', () => {
  it('uses listLocations from inventory core', async () => {
    listLocations.mockResolvedValue([{ id: 'loc-1', name: 'Storefront' }]);
    prisma.posSession.findMany.mockResolvedValue([]);
    prisma.posSession.count.mockResolvedValue(0);

    const { loadPosAdminIndexData } = await import('#/core/pos/index.server');
    const data = await loadPosAdminIndexData({ staffId: 'staff-1' });

    expect(listLocations).toHaveBeenCalled();
    expect(data.locations).toEqual([{ id: 'loc-1', name: 'Storefront' }]);
    expect(data.openSession).toBeNull();
  });
});
