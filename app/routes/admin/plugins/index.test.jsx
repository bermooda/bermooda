import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSetPluginOrder, mockSetPluginEnabledState } = vi.hoisted(() => ({
  mockSetPluginOrder: vi.fn(),
  mockSetPluginEnabledState: vi.fn(),
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPlugin: vi.fn(),
  listRegisteredPlugins: vi.fn(() => []),
  loadAllPluginSettings: vi.fn(async () => ({})),
  setPluginOrder: mockSetPluginOrder,
  savePluginSettings: vi.fn(),
  setPluginEnabledState: mockSetPluginEnabledState,
  sortPluginsByOrder: vi.fn((plugins) => plugins),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
}));

import { action } from '#/routes/admin/plugins';

function buildRequest(intent, pluginId, extra = {}) {
  const formData = new FormData();
  formData.set('intent', intent);
  if (pluginId) formData.set('pluginId', pluginId);
  for (const [key, value] of Object.entries(extra)) {
    formData.set(key, value);
  }

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
    mockSetPluginOrder.mockResolvedValue(['sample-analytics']);

    const result = await action({
      request: buildRequest('reorder', null, {
        order: JSON.stringify(['sample-analytics']),
      }),
    });

    expect(result).toEqual({ success: true, intent: 'reorder' });
    expect(mockSetPluginOrder).toHaveBeenCalledWith(['sample-analytics']);
  });
});
