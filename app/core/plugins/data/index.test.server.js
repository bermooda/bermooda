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
  readPluginData,
  writePluginData,
} from '#/core/plugins/data/index.server';

describe('plugin data helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readPluginData', () => {
    it('returns the fallback when no row exists', async () => {
      mockPluginData.findUnique.mockResolvedValue(null);

      await expect(
        readPluginData('demo-plugin', 'recentEvents', [])
      ).resolves.toEqual([]);
    });

    it('parses stored JSON values', async () => {
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: 'demo-plugin',
        key: 'recentEvents',
        value: JSON.stringify([{ orderId: 'order_1' }]),
      });

      await expect(
        readPluginData('demo-plugin', 'recentEvents', [])
      ).resolves.toEqual([{ orderId: 'order_1' }]);
    });

    it('returns the fallback when stored JSON is invalid', async () => {
      mockPluginData.findUnique.mockResolvedValue({
        pluginId: 'hold-check',
        key: 'holds',
        value: 'not-json',
      });

      await expect(readPluginData('hold-check', 'holds', [])).resolves.toEqual(
        []
      );
    });
  });

  describe('writePluginData', () => {
    it('upserts serialized JSON values', async () => {
      mockPluginData.upsert.mockResolvedValue({});

      await writePluginData('demo-plugin', 'recentEvents', [
        { orderId: 'order_1' },
      ]);

      expect(mockPluginData.upsert).toHaveBeenCalledWith({
        where: {
          pluginId_key: { pluginId: 'demo-plugin', key: 'recentEvents' },
        },
        create: {
          pluginId: 'demo-plugin',
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
