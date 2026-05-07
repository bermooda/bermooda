// app/plugins/sample-analytics/index.test.server.js
// Integration test: exercises the plugin contract end-to-end via order.created.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — inline vi.fn() so hoisting doesn't break references
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => ({
  default: {
    pluginData: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    child: vi.fn(() => ({ error: vi.fn(), info: vi.fn() })),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import prisma from '#/libs/prisma.server';

import { pluginManifest } from './index.server';

const PLUGIN_ID = 'sample-analytics';
const EVENTS_KEY = 'recentEvents';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

describe('pluginManifest', () => {
  it('has correct id and name', () => {
    expect(pluginManifest.id).toBe(PLUGIN_ID);
    expect(pluginManifest.name).toBeTruthy();
    expect(pluginManifest.version).toBeTruthy();
  });

  it('registers an order.created hook', () => {
    expect(typeof pluginManifest.hooks?.['order.created']).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// handleOrderCreated — via pluginManifest.hooks['order.created']
// ---------------------------------------------------------------------------

describe('handleOrderCreated (via pluginManifest.hooks)', () => {
  it('appends an order.created event when no prior events exist', async () => {
    prisma.pluginData.findUnique.mockResolvedValue(null);
    prisma.pluginData.upsert.mockResolvedValue({});

    const payload = {
      orderId: 'order_1',
      orderNumber: 'ORD-001',
      totalCents: 5000,
      currency: 'USD',
    };
    await pluginManifest.hooks['order.created'](payload);

    expect(prisma.pluginData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
        create: expect.objectContaining({
          pluginId: PLUGIN_ID,
          key: EVENTS_KEY,
        }),
        update: expect.objectContaining({ value: expect.any(String) }),
      })
    );

    const upsertCall = prisma.pluginData.upsert.mock.calls[0][0];
    const storedEvents = JSON.parse(upsertCall.create.value);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject({
      type: 'order.created',
      orderId: 'order_1',
      orderNumber: 'ORD-001',
      totalCents: 5000,
      currency: 'USD',
    });
    expect(storedEvents[0].capturedAt).toBeDefined();
  });

  it('prepends new event to existing events', async () => {
    const existingEvents = [
      {
        type: 'order.created',
        orderId: 'order_old',
        orderNumber: 'ORD-000',
        totalCents: 1000,
        currency: 'USD',
        capturedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    prisma.pluginData.findUnique.mockResolvedValue({
      pluginId: PLUGIN_ID,
      key: EVENTS_KEY,
      value: JSON.stringify(existingEvents),
    });
    prisma.pluginData.upsert.mockResolvedValue({});

    await pluginManifest.hooks['order.created']({
      orderId: 'order_2',
      orderNumber: 'ORD-002',
      totalCents: 2000,
      currency: 'EUR',
    });

    const upsertCall = prisma.pluginData.upsert.mock.calls[0][0];
    const storedEvents = JSON.parse(upsertCall.update.value);
    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[0].orderId).toBe('order_2'); // newest first
    expect(storedEvents[1].orderId).toBe('order_old');
  });

  it('caps stored events at 100', async () => {
    const manyEvents = Array.from({ length: 100 }, (_, i) => ({
      type: 'order.created',
      orderId: `order_${i}`,
      orderNumber: `ORD-${String(i).padStart(3, '0')}`,
      totalCents: 1000,
      currency: 'USD',
      capturedAt: '2024-01-01T00:00:00.000Z',
    }));
    prisma.pluginData.findUnique.mockResolvedValue({
      pluginId: PLUGIN_ID,
      key: EVENTS_KEY,
      value: JSON.stringify(manyEvents),
    });
    prisma.pluginData.upsert.mockResolvedValue({});

    await pluginManifest.hooks['order.created']({
      orderId: 'order_new',
      orderNumber: 'ORD-NEW',
      totalCents: 999,
      currency: 'USD',
    });

    const upsertCall = prisma.pluginData.upsert.mock.calls[0][0];
    const storedEvents = JSON.parse(upsertCall.update.value);
    expect(storedEvents).toHaveLength(100);
    expect(storedEvents[0].orderId).toBe('order_new'); // newest first
  });

  it('does not throw when prisma fails (error is swallowed)', async () => {
    prisma.pluginData.findUnique.mockRejectedValue(new Error('DB error'));

    await expect(
      pluginManifest.hooks['order.created']({
        orderId: 'order_err',
        orderNumber: 'ORD-ERR',
        totalCents: 100,
        currency: 'USD',
      })
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Plugin contract via plugin loader
// ---------------------------------------------------------------------------

describe('plugin contract end-to-end', () => {
  it('can be registered and enabled via the plugin loader', async () => {
    vi.resetModules();

    vi.mock('#/libs/prisma.server', () => ({
      default: {
        pluginData: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
      },
    }));
    vi.mock('#/utils/logger.server', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn(),
        child: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
      },
    }));
    vi.mock('#/core/events/index.server', () => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }));
    vi.mock('#/core/settings/index.server', () => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    }));

    const { register, loadPlugins } =
      await import('#/core/plugins/index.server');
    const { pluginManifest: manifest } = await import('./index.server');

    register(manifest);
    const { plugins } = loadPlugins();

    expect(plugins.some((p) => p.id === PLUGIN_ID)).toBe(true);
  });
});
