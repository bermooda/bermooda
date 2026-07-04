import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDisable, mockEnable, mockGet, mockSet, mockRegistry } = vi.hoisted(
  () => ({
    mockDisable: vi.fn(),
    mockEnable: vi.fn(),
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockRegistry: new Map(),
  })
);

vi.mock('#/core/plugins/index.server', () => ({
  _registry: mockRegistry,
  disable: mockDisable,
  enable: mockEnable,
}));

vi.mock('#/core/settings/index.server', () => ({
  get: mockGet,
  set: mockSet,
}));

import { action } from '#/routes/admin/plugins/index';

function buildRequest(intent, pluginId) {
  const formData = new FormData();
  formData.set('intent', intent);
  if (pluginId) formData.set('pluginId', pluginId);

  return new Request('http://localhost/admin/plugins', {
    method: 'POST',
    body: formData,
  });
}

describe('admin plugins action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.clear();
    mockRegistry.set('sample-analytics', {
      manifest: {
        id: 'sample-analytics',
        name: 'Sample Analytics',
        version: '1.0.0',
      },
    });
  });

  it('persists enabledPlugins before live-enabling a plugin', async () => {
    mockGet.mockResolvedValue([]);
    mockSet.mockResolvedValue(undefined);
    mockEnable.mockResolvedValue(undefined);

    const result = await action({
      request: buildRequest('enable', 'sample-analytics'),
    });

    expect(result).toEqual({ success: true, intent: 'enable' });
    expect(mockSet).toHaveBeenCalledWith('enabledPlugins', [
      'sample-analytics',
    ]);
    expect(mockEnable).toHaveBeenCalledWith('sample-analytics');
    expect(mockSet.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnable.mock.invocationCallOrder[0]
    );
  });

  it('persists enabledPlugins before live-disabling a plugin', async () => {
    mockGet.mockResolvedValue(['sample-analytics', 'other-plugin']);
    mockSet.mockResolvedValue(undefined);
    mockDisable.mockResolvedValue(undefined);

    const result = await action({
      request: buildRequest('disable', 'sample-analytics'),
    });

    expect(result).toEqual({ success: true, intent: 'disable' });
    expect(mockSet).toHaveBeenCalledWith('enabledPlugins', ['other-plugin']);
    expect(mockDisable).toHaveBeenCalledWith('sample-analytics');
    expect(mockSet.mock.invocationCallOrder[0]).toBeLessThan(
      mockDisable.mock.invocationCallOrder[0]
    );
  });

  it('returns an error for unknown plugins without mutating settings', async () => {
    const result = await action({
      request: buildRequest('enable', 'missing-plugin'),
    });

    expect(result).toEqual({ error: 'Plugin not found' });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockEnable).not.toHaveBeenCalled();
    expect(mockDisable).not.toHaveBeenCalled();
  });

  it('rolls back enabledPlugins when live enable fails', async () => {
    mockGet.mockResolvedValue(['other-plugin']);
    mockSet.mockResolvedValue(undefined);
    mockEnable.mockRejectedValue(new Error('Live wiring failed'));

    const result = await action({
      request: buildRequest('enable', 'sample-analytics'),
    });

    expect(result).toEqual({ error: 'Live wiring failed' });
    expect(mockSet).toHaveBeenNthCalledWith(1, 'enabledPlugins', [
      'other-plugin',
      'sample-analytics',
    ]);
    expect(mockEnable).toHaveBeenCalledWith('sample-analytics');
    expect(mockSet).toHaveBeenNthCalledWith(2, 'enabledPlugins', [
      'other-plugin',
    ]);
    expect(mockEnable.mock.invocationCallOrder[0]).toBeLessThan(
      mockSet.mock.invocationCallOrder[1]
    );
  });
});
