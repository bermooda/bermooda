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

import {
  appendRecentEvent,
  EVENTS_KEY,
  loadRecentEvents,
  PLUGIN_ID,
} from '#/plugins/sample-analytics/data/index.server';

describe('sample-analytics data helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadRecentEvents', () => {
    it('returns an empty array when no events are stored', async () => {
      mockPluginData.findUnique.mockResolvedValue(null);

      await expect(loadRecentEvents()).resolves.toEqual([]);
    });

    it('returns stored events', async () => {
      const events = [{ orderId: 'order_1', orderNumber: 'ORD-001' }];
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: PLUGIN_ID,
        key: EVENTS_KEY,
        value: JSON.stringify(events),
      });

      await expect(loadRecentEvents()).resolves.toEqual(events);
    });
  });

  describe('appendRecentEvent', () => {
    it('prepends a new event and caps storage at 100 items', async () => {
      const existing = Array.from({ length: 100 }, (_, index) => ({
        orderId: `order_${index}`,
        orderNumber: `ORD-${index}`,
      }));
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: PLUGIN_ID,
        key: EVENTS_KEY,
        value: JSON.stringify(existing),
      });
      mockPluginData.upsert.mockResolvedValue({});

      await appendRecentEvent({
        orderId: 'order_new',
        orderNumber: 'ORD-NEW',
        totalCents: 2500,
        currency: 'USD',
      });

      const upsertCall = mockPluginData.upsert.mock.calls[0][0];
      const storedEvents = JSON.parse(upsertCall.update.value);
      expect(storedEvents).toHaveLength(100);
      expect(storedEvents[0]).toMatchObject({
        type: 'order.created',
        orderId: 'order_new',
        orderNumber: 'ORD-NEW',
        totalCents: 2500,
        currency: 'USD',
      });
      expect(storedEvents[1].orderId).toBe('order_0');
    });
  });
});
