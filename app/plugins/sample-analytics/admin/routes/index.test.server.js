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

import { routes as adminRoutes } from '#/plugins/sample-analytics/admin/routes/index.server';

describe('sample-analytics admin route loader', () => {
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
});
