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
    warn: vi.fn(),
  },
}));

vi.mock('#/core/events/index.server', async () => {
  const actual = await vi.importActual('#/core/events/index.server');
  return {
    ...actual,
    emit: vi.fn(),
  };
});

const {
  registerPaymentProvider,
  unregisterPaymentProvider,
  registerShippingProvider,
  unregisterShippingProvider,
  registerTaxProvider,
  unregisterTaxProvider,
  registerSearchProvider,
  unregisterSearchProvider,
  setDefaultSearchProvider,
  getDefaultSearchProviderId,
} = vi.hoisted(() => ({
  registerPaymentProvider: vi.fn(),
  unregisterPaymentProvider: vi.fn(),
  registerShippingProvider: vi.fn(),
  unregisterShippingProvider: vi.fn(),
  registerTaxProvider: vi.fn(),
  unregisterTaxProvider: vi.fn(),
  registerSearchProvider: vi.fn(),
  unregisterSearchProvider: vi.fn(),
  setDefaultSearchProvider: vi.fn(),
  getDefaultSearchProviderId: vi.fn(),
}));

vi.mock('#/core/payments/index.server', () => ({
  registerProvider: registerPaymentProvider,
  unregisterProvider: unregisterPaymentProvider,
}));

vi.mock('#/core/shipping/index.server', () => ({
  registerProvider: registerShippingProvider,
  unregisterProvider: unregisterShippingProvider,
}));

vi.mock('#/core/tax/index.server', () => ({
  registerProvider: registerTaxProvider,
  unregisterProvider: unregisterTaxProvider,
}));

vi.mock('#/core/search/index.server', () => ({
  registerProvider: registerSearchProvider,
  unregisterProvider: unregisterSearchProvider,
  setDefaultProvider: setDefaultSearchProvider,
  getDefaultProviderId: getDefaultSearchProviderId,
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
  defineProviders,
  register,
  loadPlugins,
  resolvePluginAdminRoute,
  resolvePluginRoute,
  resolvePluginStorefrontRoute,
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
      storefrontRoutes: '/plugins/test/storefront/routes',
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

  it('returns a provider spec with the type attached for "search"', () => {
    const provider = { search: vi.fn() };
    const result = defineProvider('search', { provider, isDefault: true });
    expect(result.type).toBe('search');
    expect(result.provider).toBe(provider);
    expect(result.isDefault).toBe(true);
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
// defineProviders — validates provider maps
// ---------------------------------------------------------------------------

describe('defineProviders', () => {
  it('returns the provider map unchanged when all entries are valid', () => {
    const providerMap = {
      test_payment: defineProvider('payment', {
        name: 'Test Payment',
        createCheckoutSession: vi.fn(),
      }),
      test_search: defineProvider('search', {
        provider: { search: vi.fn() },
        isDefault: true,
      }),
    };

    expect(defineProviders(providerMap)).toBe(providerMap);
  });

  it('throws when providerMap is not an object', () => {
    expect(() => defineProviders(null)).toThrow();
    expect(() => defineProviders('providers')).toThrow();
  });

  it('throws when a provider entry is missing a valid type', () => {
    expect(() =>
      defineProviders({
        broken: { provider: { search: vi.fn() } },
      })
    ).toThrow(/broken/);

    expect(() =>
      defineProviders({
        broken: { type: 'inventory' },
      })
    ).toThrow(/inventory/);
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
// Route resolution
// ---------------------------------------------------------------------------

describe('resolvePluginAdminRoute', () => {
  it('resolves the sample analytics admin root route', () => {
    const descriptor = resolvePluginAdminRoute('sample-analytics', '');

    expect(descriptor).toMatchObject({ path: '' });
    expect(typeof descriptor?.loader).toBe('function');
    expect(typeof descriptor?.Component).toBe('function');
  });

  it('normalizes the admin root path before matching', () => {
    const rootDescriptor = resolvePluginAdminRoute('sample-analytics', '');

    expect(resolvePluginAdminRoute('sample-analytics', '/?tab=events')).toBe(
      rootDescriptor
    );
  });

  it('returns null when no admin route matches', () => {
    expect(resolvePluginAdminRoute('sample-analytics', 'missing')).toBeNull();
  });
});

describe('resolvePluginRoute', () => {
  it('keeps the deprecated admin alias working', () => {
    expect(resolvePluginRoute('sample-analytics', '')).toBe(
      resolvePluginAdminRoute('sample-analytics', '')
    );
  });
});

describe('resolvePluginStorefrontRoute', () => {
  it('resolves the sample analytics storefront root route', () => {
    const descriptor = resolvePluginStorefrontRoute('sample-analytics', '');

    expect(descriptor).toMatchObject({ path: '' });
    expect(typeof descriptor?.loader).toBe('function');
    expect(typeof descriptor?.Component).toBe('function');
  });

  it('returns null when no storefront route matches', () => {
    expect(
      resolvePluginStorefrontRoute('sample-analytics', 'missing')
    ).toBeNull();
    expect(resolvePluginStorefrontRoute('missing-plugin', '')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enable
// ---------------------------------------------------------------------------

describe('enable', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
    getDefaultSearchProviderId.mockReturnValue('db');
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
    expect(on).toBeDefined();
    const entry = _registry.get('plugin-a');
    expect(entry.handlers.get('order.created')).toBe(handler);
  });

  it('registers before.* hooks with an attribution wrapper', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validManifest({
      id: 'plugin-before',
      name: 'Plugin Before',
      hooks: {
        'before.shipment.create': () => {
          deny('Blocked', { code: 'FRAUD_HOLD' });
        },
      },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-before');

    await expect(
      emitBefore('shipment.create', { orderId: 'order_1' })
    ).rejects.toMatchObject({
      code: 'FRAUD_HOLD',
      pluginId: 'plugin-before',
      reason: 'Blocked',
    });

    _handlers.clear();
  });

  it('leaves an explicitly-set pluginId on HookAbortError untouched', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validManifest({
      id: 'plugin-before-2',
      name: 'Plugin Before 2',
      hooks: {
        'before.shipment.ship': () => {
          deny('Blocked', { code: 'FRAUD_HOLD', pluginId: 'custom-id' });
        },
      },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-before-2');

    await expect(
      emitBefore('shipment.ship', { orderId: 'order_1' })
    ).rejects.toMatchObject({
      pluginId: 'custom-id',
    });

    _handlers.clear();
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

  it('registers payment providers declared in manifest.providers', async () => {
    register(
      validManifest({
        id: 'plugin-payment',
        name: 'Plugin Payment',
        providers: {
          acme_pay: defineProvider('payment', {
            name: 'Acme Pay',
            createCheckoutSession: vi.fn(),
          }),
        },
      })
    );
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-payment');

    expect(registerPaymentProvider).toHaveBeenCalledOnce();
    const [providerId, provider] = registerPaymentProvider.mock.calls[0];
    expect(providerId).toBe('acme_pay');
    expect(provider).toEqual({
      name: 'Acme Pay',
      createCheckoutSession: expect.any(Function),
    });
    expect(provider).not.toHaveProperty('type');
  });

  it('registers search providers with isDefault before calling onEnable', async () => {
    const onEnable = vi.fn().mockResolvedValue(undefined);

    register(
      validManifest({
        id: 'plugin-search',
        name: 'Plugin Search',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
        },
        onEnable,
      })
    );
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-search');

    expect(registerSearchProvider).toHaveBeenCalledWith(
      'meilisearch',
      expect.objectContaining({ search: expect.any(Function) }),
      { isDefault: true }
    );
    expect(registerSearchProvider.mock.invocationCallOrder[0]).toBeLessThan(
      onEnable.mock.invocationCallOrder[0]
    );
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

  it('is idempotent for plugins that only register providers', async () => {
    register(
      validManifest({
        id: 'plugin-providers-only',
        name: 'Plugin Providers Only',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
        },
      })
    );
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-providers-only');
    await _enable('plugin-providers-only');

    expect(mockSetting.upsert).toHaveBeenCalledOnce();
    expect(registerSearchProvider).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// disable
// ---------------------------------------------------------------------------

describe('disable', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
    getDefaultSearchProviderId.mockReturnValue('db');
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
    const wrappedHandler = _registry
      .get('plugin-e')
      .handlers.get('order.created');

    mockSetting.upsert.mockResolvedValue({});

    await _disable('plugin-e');

    const { _handlers } = await import('#/core/events/index.server');
    expect(_handlers.get('order.created') ?? []).not.toContain(wrappedHandler);
    expect(_registry.get('plugin-e').handlers.size).toBe(0);
  });

  it('deregisters wrapped before.* handlers so emitBefore runs no handler', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validManifest({
      id: 'plugin-before-disable',
      name: 'Plugin Before Disable',
      hooks: {
        'before.shipment.create': () => {
          deny('Blocked');
        },
      },
    });
    register(manifest);
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-before-disable');
    await _disable('plugin-before-disable');

    await expect(
      emitBefore('shipment.create', { orderId: 'order_1' })
    ).resolves.toEqual({ orderId: 'order_1' });

    _handlers.clear();
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

  it('unregisters manifest providers and restores the previous search default', async () => {
    register(
      validManifest({
        id: 'plugin-search-disable',
        name: 'Plugin Search Disable',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
          acme_pay: defineProvider('payment', {
            name: 'Acme Pay',
            createCheckoutSession: vi.fn(),
          }),
        },
      })
    );
    mockSetting.upsert.mockResolvedValue({});

    await _enable('plugin-search-disable');
    vi.clearAllMocks();
    mockSetting.upsert.mockResolvedValue({});

    await _disable('plugin-search-disable');

    expect(unregisterSearchProvider).toHaveBeenCalledWith('meilisearch');
    expect(unregisterPaymentProvider).toHaveBeenCalledWith('acme_pay');
    expect(setDefaultSearchProvider).toHaveBeenCalledWith('db');
  });

  it('supports meilisearch-style manifests without manual lifecycle wiring', async () => {
    register(
      definePlugin({
        id: 'meilisearch-style',
        name: 'Meilisearch Style',
        version: '1.0.0',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
        },
      })
    );
    mockSetting.upsert.mockResolvedValue({});

    await _enable('meilisearch-style');

    expect(registerSearchProvider).toHaveBeenCalledWith(
      'meilisearch',
      expect.objectContaining({ search: expect.any(Function) }),
      { isDefault: true }
    );

    vi.clearAllMocks();
    mockSetting.upsert.mockResolvedValue({});

    await _disable('meilisearch-style');

    expect(unregisterSearchProvider).toHaveBeenCalledWith('meilisearch');
    expect(setDefaultSearchProvider).toHaveBeenCalledWith('db');
  });
});
