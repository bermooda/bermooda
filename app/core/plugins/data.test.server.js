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

import { readPluginData, writePluginData } from '#/core/plugins/data.server';

describe('plugin data helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readPluginData', () => {
    it('returns the fallback when no row exists', async () => {
      mockPluginData.findUnique.mockResolvedValue(null);

      await expect(
        readPluginData('sample-analytics', 'recentEvents', [])
      ).resolves.toEqual([]);
    });

    it('parses stored JSON values', async () => {
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: 'sample-analytics',
        key: 'recentEvents',
        value: JSON.stringify([{ orderId: 'order_1' }]),
      });

      await expect(
        readPluginData('sample-analytics', 'recentEvents', [])
      ).resolves.toEqual([{ orderId: 'order_1' }]);
    });

    it('returns the fallback when stored JSON is invalid', async () => {
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: 'fraud-guard',
        key: 'holds',
        value: 'not-json',
      });

      await expect(readPluginData('fraud-guard', 'holds', [])).resolves.toEqual(
        []
      );
    });
  });

  describe('writePluginData', () => {
    it('upserts serialized JSON values', async () => {
      mockPluginData.upsert.mockResolvedValue({});

      await writePluginData('sample-analytics', 'recentEvents', [
        { orderId: 'order_1' },
      ]);

      expect(mockPluginData.upsert).toHaveBeenCalledWith({
        where: {
          pluginId_key: { pluginId: 'sample-analytics', key: 'recentEvents' },
        },
        create: {
          pluginId: 'sample-analytics',
          key: 'recentEvents',
          value: JSON.stringify([{ orderId: 'order_1' }]),
        },
        update: {
          value: JSON.stringify([{ orderId: 'order_1' }]),
        },
      });
    });
  });
});
