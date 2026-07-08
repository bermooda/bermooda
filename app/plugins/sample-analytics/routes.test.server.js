import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPluginData } = vi.hoisted(() => ({
  mockPluginData: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    pluginData: mockPluginData,
  },
}));

import { routes as adminRoutes } from '#/plugins/sample-analytics/admin/routes.server';
import { routes as storefrontRoutes } from '#/plugins/sample-analytics/storefront/routes.server';

describe('sample-analytics route loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin loader returns stored events', async () => {
    const events = [
      {
        orderId: 'order_1',
        orderNumber: 'ORD-001',
        totalCents: 5000,
        currency: 'USD',
        capturedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockPluginData.findUnique.mockResolvedValue({
      pluginId: 'sample-analytics',
      key: 'recentEvents',
      value: JSON.stringify(events),
    });

    const result = await adminRoutes[0].loader();

    expect(result).toEqual({ events });
  });

  it('storefront loader returns event count and latest event', async () => {
    const events = [
      {
        orderId: 'order_2',
        orderNumber: 'ORD-002',
        totalCents: 2000,
        currency: 'EUR',
        capturedAt: '2024-02-01T00:00:00.000Z',
      },
      {
        orderId: 'order_1',
        orderNumber: 'ORD-001',
        totalCents: 1000,
        currency: 'USD',
        capturedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockPluginData.findUnique.mockResolvedValue({
      pluginId: 'sample-analytics',
      key: 'recentEvents',
      value: JSON.stringify(events),
    });

    const result = await storefrontRoutes[0].loader();

    expect(result).toEqual({
      eventCount: 2,
      latestEvent: events[0],
    });
  });
});
