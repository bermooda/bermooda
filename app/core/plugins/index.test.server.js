// app/core/plugins/index.test.server.js
// Server-environment tests for the plugin loader (runs in Node, not happy-dom).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use the mocked modules.
// ---------------------------------------------------------------------------

vi.mock('#/utils/logger.server', () => ({
  default: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('#/core/events/index.server', () => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

// Mock prisma — no real database.
const mockPluginData = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const mockSetting = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock('#/libs/prisma.server', () => ({
  default: {
    pluginData: mockPluginData,
    setting: mockSetting,
  },
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

const {
  definePlugin,
  defineHooks,
  defineProvider,
  register,
  loadPlugins,
  resolvePluginRoute,
  enable: _enable,
  disable: _disable,
  _registry,
  _buildCtx,
} = await import('#/core/plugins/index.server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validManifest(overrides = {}) {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// definePlugin — manifest validation
// ---------------------------------------------------------------------------

describe('definePlugin', () => {
  it('returns the manifest when all required fields are present', () => {
    const manifest = validManifest();
    expect(definePlugin(manifest)).toEqual(manifest);
  });

  it('throws when "id" is missing', () => {
    expect(() => definePlugin({ name: 'Test', version: '1.0.0' })).toThrow(
      /id/
    );
  });

  it('throws when "id" is an empty string', () => {
    expect(() =>
      definePlugin({ id: '', name: 'Test', version: '1.0.0' })
    ).toThrow(/id/);
  });

  it('throws when "id" is whitespace only', () => {
    expect(() =>
      definePlugin({ id: '   ', name: 'Test', version: '1.0.0' })
    ).toThrow(/id/);
  });

  it('throws when "name" is missing', () => {
    expect(() => definePlugin({ id: 'my-plugin', version: '1.0.0' })).toThrow(
      /name/
    );
  });

  it('throws when "name" is an empty string', () => {
    expect(() =>
      definePlugin({ id: 'my-plugin', name: '', version: '1.0.0' })
    ).toThrow(/name/);
  });

  it('throws when "version" is missing', () => {
    expect(() => definePlugin({ id: 'my-plugin', name: 'My Plugin' })).toThrow(
      /version/
    );
  });

  it('throws when "version" is an empty string', () => {
    expect(() =>
      definePlugin({ id: 'my-plugin', name: 'My Plugin', version: '' })
    ).toThrow(/version/);
  });

  it('throws when manifest is not an object', () => {
    expect(() => definePlugin(null)).toThrow();
    expect(() => definePlugin('string')).toThrow();
    expect(() => definePlugin(42)).toThrow();
  });

  it('accepts optional fields without throwing', () => {
    const manifest = validManifest({
      description: 'A test plugin',
      adminRoutes: '/plugins/test/routes',
    });
    expect(() => definePlugin(manifest)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// defineHooks — returns hook map unchanged
// ---------------------------------------------------------------------------

describe('defineHooks', () => {
  it('returns the hooks object unchanged', () => {
    const hooks = {
      'order.created': vi.fn(),
      'order.shipped': vi.fn(),
    };
    expect(defineHooks(hooks)).toBe(hooks);
  });

  it('accepts an empty hooks object', () => {
    expect(defineHooks({})).toEqual({});
  });

  it('throws when a hook value is not a function', () => {
    expect(() => defineHooks({ 'order.created': 'not a function' })).toThrow(
      /order.created/
    );
  });

  it('throws when hookMap is not an object', () => {
    expect(() => defineHooks(null)).toThrow();
    expect(() => defineHooks('hooks')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// defineProvider — validates type
// ---------------------------------------------------------------------------

describe('defineProvider', () => {
  it('returns a provider spec with the type attached for "payment"', () => {
    const spec = { name: 'Stripe', charge: vi.fn() };
    const result = defineProvider('payment', spec);
    expect(result.type).toBe('payment');
    expect(result.name).toBe('Stripe');
  });

  it('returns a provider spec with the type attached for "shipping"', () => {
    const result = defineProvider('shipping', { name: 'FedEx' });
    expect(result.type).toBe('shipping');
  });

  it('returns a provider spec with the type attached for "tax"', () => {
    const result = defineProvider('tax', { name: 'TaxJar' });
    expect(result.type).toBe('tax');
  });

  it('throws for an invalid provider type', () => {
    expect(() => defineProvider('inventory', {})).toThrow(/inventory/);
    expect(() => defineProvider('', {})).toThrow();
    expect(() => defineProvider('PAYMENT', {})).toThrow();
  });

  it('throws when spec is not an object', () => {
    expect(() => defineProvider('payment', null)).toThrow();
    expect(() => defineProvider('payment', 'spec')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Plugin ctx — plugin.get / plugin.set / plugin.delete
// ---------------------------------------------------------------------------

describe('Plugin ctx — plugin.get / plugin.set / plugin.delete', () => {
  const pluginId = 'my-test-plugin';
  let ctx;

  beforeEach(() => {
    ctx = _buildCtx(pluginId);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('plugin.get', () => {
    it('calls prisma.pluginData.findUnique with pluginId + key', async () => {
      mockPluginData.findUnique.mockResolvedValueOnce({
        pluginId,
        key: 'theme',
        value: 'dark',
      });

      const result = await ctx.plugin.get('theme');

      expect(mockPluginData.findUnique).toHaveBeenCalledWith({
        where: { pluginId_key: { pluginId, key: 'theme' } },
      });
      expect(result).toBe('dark');
    });

    it('returns null when the key does not exist', async () => {
      mockPluginData.findUnique.mockResolvedValueOnce(null);

      const result = await ctx.plugin.get('missing-key');

      expect(result).toBeNull();
    });

    it('is namespaced — different pluginId produces different query', async () => {
      const ctx2 = _buildCtx('other-plugin');
      mockPluginData.findUnique.mockResolvedValue(null);

      await ctx.plugin.get('key');
      await ctx2.plugin.get('key');

      expect(mockPluginData.findUnique).toHaveBeenNthCalledWith(1, {
        where: { pluginId_key: { pluginId: 'my-test-plugin', key: 'key' } },
      });
      expect(mockPluginData.findUnique).toHaveBeenNthCalledWith(2, {
        where: { pluginId_key: { pluginId: 'other-plugin', key: 'key' } },
      });
    });
  });

  describe('plugin.set', () => {
    it('calls prisma.pluginData.upsert with pluginId + key + stringified value', async () => {
      mockPluginData.upsert.mockResolvedValueOnce({});

      await ctx.plugin.set('count', 42);

      expect(mockPluginData.upsert).toHaveBeenCalledWith({
        where: { pluginId_key: { pluginId, key: 'count' } },
        create: { pluginId, key: 'count', value: '42' },
        update: { value: '42' },
      });
    });

    it('stringifies object values', async () => {
      mockPluginData.upsert.mockResolvedValueOnce({});
      const obj = { foo: 'bar' };

      await ctx.plugin.set('config', obj);

      expect(mockPluginData.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ value: JSON.stringify(obj) }),
        })
      );
    });
  });

  describe('plugin.delete', () => {
    it('calls prisma.pluginData.delete with pluginId + key', async () => {
      mockPluginData.delete.mockResolvedValueOnce({});

      await ctx.plugin.delete('theme');

      expect(mockPluginData.delete).toHaveBeenCalledWith({
        where: { pluginId_key: { pluginId, key: 'theme' } },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// loadPlugins — stable return shape
// ---------------------------------------------------------------------------

describe('loadPlugins', () => {
  beforeEach(() => {
    _registry.clear();
  });

  it('returns { plugins: [], hooks: {} } when no plugins are registered', () => {
    const result = loadPlugins();
    expect(result).toEqual({ plugins: [], hooks: {} });
  });

  it('returns registered plugins after register()', () => {
    register(validManifest({ id: 'plugin-a', name: 'Plugin A' }));
    const { plugins } = loadPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe('plugin-a');
  });
});

// ---------------------------------------------------------------------------
// resolvePluginRoute — returns null
// ---------------------------------------------------------------------------

describe('resolvePluginRoute', () => {
  it('returns null for any input', () => {
    expect(resolvePluginRoute('my-plugin', '/admin')).toBeNull();
    expect(resolvePluginRoute('', '')).toBeNull();
    expect(resolvePluginRoute(null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enable
// ---------------------------------------------------------------------------

describe('enable', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('throws when pluginId is not registered', async () => {
    await expect(_enable('unregistered-plugin')).rejects.toThrow(
      /Plugin "unregistered-plugin" is not registered/
    );
  });

  it('persists enabled=true in settings and calls on() for each hook', async () => {
    const handler = vi.fn();
    const manifest = validManifest({
      id: 'plugin-a',
      name: 'Plugin A',
      hooks: { 'order.created': handler },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-a');

    // Setting persisted
    expect(mockSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'plugin.plugin-a.enabled',
          value: 'true',
        }),
      })
    );

    // Hook registered
    const { on } = await import('#/core/events/index.server');
    expect(on).toHaveBeenCalledWith('order.created', handler);
  });

  it('calls onEnable(ctx) when present', async () => {
    const onEnable = vi.fn().mockResolvedValue(undefined);
    const manifest = validManifest({
      id: 'plugin-b',
      name: 'Plugin B',
      onEnable,
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-b');

    expect(onEnable).toHaveBeenCalledOnce();
    // ctx should have plugin, settings, emit, queue, logger, t properties
    const ctx = onEnable.mock.calls[0][0];
    expect(ctx).toHaveProperty('plugin');
    expect(ctx).toHaveProperty('settings');
    expect(ctx).toHaveProperty('emit');
    expect(ctx).toHaveProperty('logger');
  });

  it('is idempotent — second call does nothing when already enabled', async () => {
    // The guard is `handlers.size > 0`, so the plugin must have at least one
    // hook so the first enable() populates handlers and the second no-ops.
    const handler = vi.fn();
    const manifest = validManifest({
      id: 'plugin-c',
      name: 'Plugin C',
      hooks: { 'order.created': handler },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-c');
    await _enable('plugin-c'); // second call — should be a no-op

    // upsert called only once (on first enable)
    expect(mockSetting.upsert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// disable
// ---------------------------------------------------------------------------

describe('disable', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('throws when pluginId is not registered', async () => {
    await expect(_disable('unregistered-plugin')).rejects.toThrow(
      /Plugin "unregistered-plugin" is not registered/
    );
  });

  it('persists enabled=false in settings', async () => {
    const manifest = validManifest({ id: 'plugin-d', name: 'Plugin D' });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _disable('plugin-d');

    expect(mockSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'plugin.plugin-d.enabled',
          value: 'false',
        }),
      })
    );
  });

  it('calls off() for each registered handler and clears handlers', async () => {
    const handler = vi.fn();
    const manifest = validManifest({
      id: 'plugin-e',
      name: 'Plugin E',
      hooks: { 'order.created': handler },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    // Enable first so handlers are registered
    await _enable('plugin-e');

    const { off } = await import('#/core/events/index.server');
    vi.clearAllMocks();
    mockSetting.upsert.mockResolvedValue({});

    await _disable('plugin-e');

    expect(off).toHaveBeenCalledWith('order.created', handler);
    // Registry entry's handlers map should be cleared
    expect(_registry.get('plugin-e').handlers.size).toBe(0);
  });

  it('calls onDisable(ctx) when present', async () => {
    const onDisable = vi.fn().mockResolvedValue(undefined);
    const manifest = validManifest({
      id: 'plugin-f',
      name: 'Plugin F',
      onDisable,
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _disable('plugin-f');

    expect(onDisable).toHaveBeenCalledOnce();
    const ctx = onDisable.mock.calls[0][0];
    expect(ctx).toHaveProperty('plugin');
  });
});
