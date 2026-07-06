// app/core/audit/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';
import {
  buildAuditLogWhere,
  entityIdFromPayload,
  entityTypeFromEvent,
  getAuditLog,
  listAuditLogs,
  parseAuditListParams,
  recordAdminAudit,
  recordAuditLog,
  registerAuditSubscribers,
  resolveAuditEntity,
} from '#/core/audit/index.server';

function mockAuditEntry(overrides = {}) {
  return {
    id: 'audit-1',
    actorType: 'admin',
    actorId: 'user-1',
    actorEmail: 'admin@test.com',
    action: 'customer.updated',
    entityType: 'customer',
    entityId: 'cust-1',
    diffJson: null,
    metadataJson: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createEventBus() {
  const handlers = new Map();
  const on = vi.fn((event, handler) => {
    if (!handlers.has(event)) handlers.set(event, []);
    handlers.get(event).push(handler);
  });
  return { on, handlers };
}

describe('audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseAuditListParams normalizes pagination and filters', () => {
    const params = new URLSearchParams(
      'page=2&limit=200&action=order.created&entityType=order&actorId=u1'
    );
    expect(parseAuditListParams(params)).toEqual({
      page: 2,
      limit: 100,
      action: 'order.created',
      entityType: 'order',
      actorId: 'u1',
    });
  });

  it('buildAuditLogWhere omits empty filters', () => {
    expect(buildAuditLogWhere({ action: 'order.created' })).toEqual({
      action: 'order.created',
    });
    expect(buildAuditLogWhere()).toEqual({});
  });

  it('resolveAuditEntity maps domain events to entity fields', () => {
    expect(resolveAuditEntity('product.deleted', { productId: 'p1' })).toEqual({
      entityType: 'product',
      entityId: 'p1',
    });
    expect(entityTypeFromEvent('payment.refunded')).toBe('refund');
    expect(entityIdFromPayload('payment.refunded', { refundId: 'r1' })).toBe(
      'r1'
    );
  });

  it('recordAuditLog persists an entry', async () => {
    prisma.auditLog.create.mockResolvedValue(
      mockAuditEntry({ diffJson: '{"name":"Jane"}' })
    );

    const result = await recordAuditLog({
      actorType: 'admin',
      actorId: 'user-1',
      actorEmail: 'admin@test.com',
      action: 'customer.updated',
      entityType: 'customer',
      entityId: 'cust-1',
      diff: { name: 'Jane' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'customer.updated',
        diffJson: '{"name":"Jane"}',
      }),
    });
    expect(result.diff).toEqual({ name: 'Jane' });
  });

  it('recordAdminAudit uses admin actor type', async () => {
    prisma.auditLog.create.mockResolvedValue(
      mockAuditEntry({
        id: 'audit-2',
        action: 'order.cancelled',
        entityType: 'order',
        entityId: 'o1',
      })
    );

    await recordAdminAudit({
      user: { id: 'u1', email: 'a@b.com' },
      action: 'order.cancelled',
      entityType: 'order',
      entityId: 'o1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorType: 'admin', actorId: 'u1' }),
    });
  });

  it('getAuditLog returns a serialized entry', async () => {
    prisma.auditLog.findUnique.mockResolvedValue(
      mockAuditEntry({ metadataJson: '{"orderId":"o1"}' })
    );

    const result = await getAuditLog('audit-1');

    expect(result.id).toBe('audit-1');
    expect(result.metadata).toEqual({ orderId: 'o1' });
  });

  it('getAuditLog throws NOT_FOUND when missing', async () => {
    prisma.auditLog.findUnique.mockResolvedValue(null);

    await expect(getAuditLog('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('listAuditLogs returns paginated results', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      mockAuditEntry({
        actorType: 'system',
        actorId: null,
        actorEmail: null,
        action: 'order.created',
        entityType: 'order',
        entityId: 'o1',
        metadataJson: '{"orderId":"o1"}',
        createdAt: new Date('2026-01-02'),
      }),
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await listAuditLogs({
      page: 1,
      limit: 10,
      action: 'order.created',
    });

    expect(result.auditLogs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.auditLogs[0].metadata).toEqual({ orderId: 'o1' });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: 'order.created' },
        take: 10,
      })
    );
  });

  it('registerAuditSubscribers writes system entries on events', async () => {
    const { on, handlers } = createEventBus();

    prisma.auditLog.create.mockResolvedValue(
      mockAuditEntry({
        id: 'a2',
        actorType: 'system',
        actorId: null,
        actorEmail: null,
        action: 'order.created',
        entityType: 'order',
        entityId: 'o99',
        metadataJson: '{"orderId":"o99"}',
      })
    );

    registerAuditSubscribers({ on });

    expect(on).toHaveBeenCalled();
    await handlers.get('order.created')[0]({ orderId: 'o99' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'system',
        action: 'order.created',
        entityId: 'o99',
      }),
    });
  });

  it('maps product events to product audit entries', async () => {
    const { on, handlers } = createEventBus();

    prisma.auditLog.create.mockResolvedValue(
      mockAuditEntry({
        id: 'a3',
        actorType: 'system',
        action: 'product.deleted',
        entityType: 'product',
        entityId: 'prod_99',
        metadataJson: '{"productId":"prod_99"}',
      })
    );

    registerAuditSubscribers({ on });
    await handlers.get('product.deleted')[0]({ productId: 'prod_99' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'product.deleted',
        entityType: 'product',
        entityId: 'prod_99',
      }),
    });
  });

  it('maps customer.registered to the customer entity id', async () => {
    const { on, handlers } = createEventBus();

    prisma.auditLog.create.mockResolvedValue(
      mockAuditEntry({
        id: 'a4',
        actorType: 'system',
        action: 'customer.registered',
        entityType: 'customer',
        entityId: 'cust_99',
        metadataJson: '{"customerId":"cust_99"}',
      })
    );

    registerAuditSubscribers({ on });
    await handlers.get('customer.registered')[0]({ customerId: 'cust_99' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'customer.registered',
        entityType: 'customer',
        entityId: 'cust_99',
      }),
    });
  });
});
