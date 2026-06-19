// app/core/audit/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';
import {
  recordAuditLog,
  recordAdminAudit,
  listAuditLogs,
  registerAuditSubscribers,
} from '#/core/audit/index.server';

describe('audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordAuditLog persists an entry', async () => {
    prisma.auditLog.create.mockResolvedValue({
      id: 'audit-1',
      actorType: 'admin',
      actorId: 'user-1',
      actorEmail: 'admin@test.com',
      action: 'customer.updated',
      entityType: 'customer',
      entityId: 'cust-1',
      diffJson: '{"name":"Jane"}',
      metadataJson: null,
      createdAt: new Date('2026-01-01'),
    });

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
    prisma.auditLog.create.mockResolvedValue({
      id: 'audit-2',
      actorType: 'admin',
      actorId: 'u1',
      actorEmail: 'a@b.com',
      action: 'order.cancelled',
      entityType: 'order',
      entityId: 'o1',
      diffJson: null,
      metadataJson: null,
      createdAt: new Date(),
    });

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

  it('listAuditLogs returns paginated results', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        actorType: 'system',
        actorId: null,
        actorEmail: null,
        action: 'order.created',
        entityType: 'order',
        entityId: 'o1',
        diffJson: null,
        metadataJson: '{"orderId":"o1"}',
        createdAt: new Date('2026-01-02'),
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await listAuditLogs({ page: 1, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.metadata).toBeUndefined();
    expect(result.items[0].metadata).toEqual({ orderId: 'o1' });
  });

  it('registerAuditSubscribers writes system entries on events', async () => {
    const handlers = new Map();
    const on = vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    });

    prisma.auditLog.create.mockResolvedValue({
      id: 'a2',
      actorType: 'system',
      actorId: null,
      actorEmail: null,
      action: 'order.created',
      entityType: 'order',
      entityId: 'o99',
      diffJson: null,
      metadataJson: '{"orderId":"o99"}',
      createdAt: new Date(),
    });

    registerAuditSubscribers({ on });

    expect(on).toHaveBeenCalled();
    const orderCreatedHandlers = handlers.get('order.created');
    expect(orderCreatedHandlers?.length).toBe(1);
    await orderCreatedHandlers[0]({ orderId: 'o99' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'system',
        action: 'order.created',
        entityId: 'o99',
      }),
    });
  });
});
