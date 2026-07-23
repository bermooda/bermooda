// app/core/admin/slots.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/plugins/index.server', () => ({
  getPluginBlocksForSlot: vi.fn(),
}));

import {
  ADMIN_SLOT_NAMES,
  getAdminSlotBlocks,
  getAdminSlotBlocksMap,
} from '#/core/admin/slots/index.server';
import { getPluginBlocksForSlot } from '#/core/plugins/index.server';

describe('ADMIN_SLOT_NAMES', () => {
  it('includes the initial admin slot catalog', () => {
    expect(ADMIN_SLOT_NAMES).toEqual([
      'dashboard.widgets',
      'order.detail',
      'customer.detail',
      'product.editor',
    ]);
  });
});

describe('getAdminSlotBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to getPluginBlocksForSlot', async () => {
    getPluginBlocksForSlot.mockResolvedValueOnce([
      { pluginId: 'sample-analytics', component: () => null },
    ]);

    const blocks = await getAdminSlotBlocks('dashboard.widgets');

    expect(getPluginBlocksForSlot).toHaveBeenCalledWith('dashboard.widgets');
    expect(blocks).toEqual([
      { pluginId: 'sample-analytics', component: expect.any(Function) },
    ]);
  });
});

describe('getAdminSlotBlocksMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a slot-keyed map for every requested slot', async () => {
    getPluginBlocksForSlot
      .mockResolvedValueOnce([
        { pluginId: 'sample-analytics', component: () => null },
      ])
      .mockResolvedValueOnce([]);

    const slotBlocks = await getAdminSlotBlocksMap([
      'dashboard.widgets',
      'order.detail',
    ]);

    expect(getPluginBlocksForSlot).toHaveBeenCalledTimes(2);
    expect(getPluginBlocksForSlot).toHaveBeenNthCalledWith(
      1,
      'dashboard.widgets'
    );
    expect(getPluginBlocksForSlot).toHaveBeenNthCalledWith(2, 'order.detail');
    expect(slotBlocks).toEqual({
      'dashboard.widgets': [
        { pluginId: 'sample-analytics', component: expect.any(Function) },
      ],
      'order.detail': [],
    });
  });
});
