import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReorderPlugin, mockSetPluginEnabledState } = vi.hoisted(() => ({
  mockReorderPlugin: vi.fn(),
  mockSetPluginEnabledState: vi.fn(),
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPlugin: vi.fn(),
  listRegisteredPlugins: vi.fn(() => []),
  loadAllPluginSettings: vi.fn(async () => ({})),
  reorderPlugin: mockReorderPlugin,
  savePluginSettings: vi.fn(),
  setPluginEnabledState: mockSetPluginEnabledState,
  sortPluginsByOrder: vi.fn((plugins) => plugins),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
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
  });

  it('enables a plugin through the core helper', async () => {
    mockSetPluginEnabledState.mockResolvedValue(undefined);

    const result = await action({
      request: buildRequest('enable', 'sample-analytics'),
    });

    expect(result).toEqual({ success: true, intent: 'enable' });
    expect(mockSetPluginEnabledState).toHaveBeenCalledWith(
      'sample-analytics',
      true
    );
  });

  it('disables a plugin through the core helper', async () => {
    mockSetPluginEnabledState.mockResolvedValue(undefined);

    const result = await action({
      request: buildRequest('disable', 'sample-analytics'),
    });

    expect(result).toEqual({ success: true, intent: 'disable' });
    expect(mockSetPluginEnabledState).toHaveBeenCalledWith(
      'sample-analytics',
      false
    );
  });

  it('returns an error when enable fails', async () => {
    mockSetPluginEnabledState.mockRejectedValue(
      new Error('Live wiring failed')
    );

    const result = await action({
      request: buildRequest('enable', 'sample-analytics'),
    });

    expect(result).toEqual({ error: 'Live wiring failed' });
  });

  it('reorders plugins through the core helper', async () => {
    mockReorderPlugin.mockResolvedValue(['sample-analytics']);

    const result = await action({
      request: buildRequest('reorder-up', 'sample-analytics'),
    });

    expect(result).toEqual({ success: true, intent: 'reorder-up' });
    expect(mockReorderPlugin).toHaveBeenCalledWith('sample-analytics', 'up');
  });
});
