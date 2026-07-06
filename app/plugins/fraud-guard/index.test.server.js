import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    child: vi.fn(() => ({ warn: vi.fn(), info: vi.fn() })),
  },
}));

const { mockPluginData, mockSetting } = vi.hoisted(() => ({
  mockPluginData: {
    findUnique: vi.fn(),
  },
  mockSetting: {
    upsert: vi.fn(),
  },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    pluginData: mockPluginData,
    setting: mockSetting,
  },
}));

vi.mock('#/core/payments/index.server', () => ({
  registerProvider: vi.fn(),
  unregisterProvider: vi.fn(),
}));

vi.mock('#/core/shipping/index.server', () => ({
  registerProvider: vi.fn(),
  unregisterProvider: vi.fn(),
}));

vi.mock('#/core/tax/index.server', () => ({
  registerProvider: vi.fn(),
  unregisterProvider: vi.fn(),
}));

vi.mock('#/core/search/index.server', () => ({
  registerProvider: vi.fn(),
  unregisterProvider: vi.fn(),
  setDefaultProvider: vi.fn(),
  getDefaultProviderId: vi.fn(() => 'db'),
}));

vi.mock('#/core/i18n/index.server', () => ({
  loadMessages: vi.fn().mockResolvedValue({}),
}));

import { deny, emitBefore, _handlers } from '#/core/events/index.server';
import { enable, register, _registry } from '#/core/plugins/index.server';

import { pluginManifest } from '#/plugins/fraud-guard/index.server';

const PLUGIN_ID = 'fraud-guard';
const HOLD_KEY = 'holds';

describe('fraud-guard plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _handlers.clear();
    _registry.clear();
    register(pluginManifest);
    mockSetting.upsert.mockResolvedValue({});
  });

  it('registers before.shipment.create and before.shipment.ship hooks', () => {
    expect(typeof pluginManifest.hooks?.['before.shipment.create']).toBe(
      'function'
    );
    expect(typeof pluginManifest.hooks?.['before.shipment.ship']).toBe(
      'function'
    );
  });

  it('vetoes fulfillment when the order is on hold', async () => {
    mockPluginData.findUnique.mockResolvedValue({
      pluginId: PLUGIN_ID,
      key: HOLD_KEY,
      value: JSON.stringify(['order_held']),
    });

    await enable(PLUGIN_ID);

    await expect(
      emitBefore('shipment.create', { orderId: 'order_held' })
    ).rejects.toMatchObject({
      code: 'FRAUD_HOLD',
      pluginId: PLUGIN_ID,
      reason: 'This order is on a fraud hold and cannot be fulfilled.',
    });
  });

  it('allows fulfillment when the order is not on hold', async () => {
    mockPluginData.findUnique.mockResolvedValue({
      pluginId: PLUGIN_ID,
      key: HOLD_KEY,
      value: JSON.stringify(['other-order']),
    });

    await enable(PLUGIN_ID);

    await expect(
      emitBefore('shipment.create', { orderId: 'order_clear' })
    ).resolves.toEqual({ orderId: 'order_clear' });
  });

  it('deny() throws HookAbortError with the configured code', () => {
    expect(() => deny('Blocked', { code: 'FRAUD_HOLD' })).toThrow(
      expect.objectContaining({
        code: 'FRAUD_HOLD',
        reason: 'Blocked',
        blocked: true,
      })
    );
  });
});
