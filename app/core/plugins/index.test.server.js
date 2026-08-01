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

vi.mock('#/core/i18n/index.server', () => ({
  loadMessages: vi.fn().mockResolvedValue({}),
}));

vi.mock('#/core/events/job.server', () => ({
  queueEmit: vi.fn(),
}));

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
  registerEmailProvider,
  unregisterEmailProvider,
  setActiveEmailProvider,
  getActiveEmailProviderId,
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
  registerEmailProvider: vi.fn(),
  unregisterEmailProvider: vi.fn(),
  setActiveEmailProvider: vi.fn(),
  getActiveEmailProviderId: vi.fn(),
}));

const { settingsGet, settingsSet } = vi.hoisted(() => ({
  settingsGet: vi.fn().mockResolvedValue(null),
  settingsSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: settingsGet,
  set: settingsSet,
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

vi.mock('#/libs/email/index.server', () => ({
  registerProvider: registerEmailProvider,
  unregisterProvider: unregisterEmailProvider,
  setActiveProvider: setActiveEmailProvider,
  getActiveProviderId: getActiveEmailProviderId,
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
  listRegisteredPlugins,
  getRegisteredPluginBySlug,
  getEnabledPluginIds,
  resolvePluginAdminRoute,
  resolvePluginStorefrontRoute,
  sortPluginsByOrder,
  buildFullPluginOrder,
  enable: _enable,
  disable: _disable,
  setPluginEnabledState,
  pluginProvidesType,
  __resetRegistry,
  _registry,
  _buildCtx,
} = await import('#/core/plugins/index.server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPlugin(overrides = {}) {
  return {
    id: '@bermooda/test-plugin',
    title: 'Test Plugin',
    version: '1.0.0',
    slug: 'test-plugin',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// definePlugin — manifest validation
// ---------------------------------------------------------------------------

describe('definePlugin', () => {
  it('returns runtime hooks without requiring identity fields', () => {
    const runtime = { hooks: {} };
    expect(definePlugin(runtime)).toBe(runtime);
  });

  it('returns runtime providers after validation', () => {
    const providers = {
      test_search: defineProvider('search', {
        provider: { search: vi.fn() },
      }),
    };
    const runtime = { providers };
    expect(definePlugin(runtime)).toBe(runtime);
  });

  it('throws when providers are invalid', () => {
    expect(() =>
      definePlugin({ providers: { broken: { type: 'inventory' } } })
    ).toThrow(/inventory/);
  });

  it('throws when manifest is not an object', () => {
    expect(() => definePlugin(null)).toThrow();
    expect(() => definePlugin('string')).toThrow();
    expect(() => definePlugin(42)).toThrow();
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

  it('returns a provider spec with the type attached for "email"', () => {
    const result = defineProvider('email', {
      name: 'Postmark',
      send: vi.fn(),
    });
    expect(result.type).toBe('email');
    expect(result.name).toBe('Postmark');
    expect(typeof result.send).toBe('function');
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
// listRegisteredPlugins
// ---------------------------------------------------------------------------

describe('listRegisteredPlugins', () => {
  beforeEach(() => {
    __resetRegistry();
  });

  it('returns an empty array when no plugins are registered', () => {
    expect(listRegisteredPlugins()).toEqual([]);
  });

  it('returns registered plugins after register()', () => {
    register(validPlugin({ id: 'plugin-a', title: 'Plugin A' }));
    const plugins = listRegisteredPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe('plugin-a');
  });
});

// ---------------------------------------------------------------------------
// register — full plugin identity validation
// ---------------------------------------------------------------------------

describe('register', () => {
  beforeEach(() => {
    __resetRegistry();
  });

  it('requires full package identity fields', () => {
    for (const field of ['id', 'title', 'version', 'slug']) {
      expect(() => register({ ...validPlugin(), [field]: undefined })).toThrow(
        new RegExp(field)
      );
    }
  });

  it('requires a lowercase hyphenated slug', () => {
    expect(() => register(validPlugin({ slug: 'Test_Plugin' }))).toThrow(
      /slug/
    );
  });

  it('getRegisteredPluginBySlug returns plugin registered under slug', () => {
    register(validPlugin());
    expect(getRegisteredPluginBySlug('test-plugin')?.id).toBe(
      '@bermooda/test-plugin'
    );
  });
});

describe('getEnabledPluginIds', () => {
  it('returns the persisted enabledPlugins array', async () => {
    settingsGet.mockResolvedValueOnce(['@bermooda/plugin-meilisearch']);
    await expect(getEnabledPluginIds()).resolves.toEqual([
      '@bermooda/plugin-meilisearch',
    ]);
  });

  it('returns an empty array when the setting is missing', async () => {
    settingsGet.mockResolvedValueOnce(null);
    await expect(getEnabledPluginIds()).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Plugin ordering helpers
// ---------------------------------------------------------------------------

describe('sortPluginsByOrder', () => {
  it('orders plugins by stored pluginOrder with untracked ids last', () => {
    const plugins = [
      { id: 'b', name: 'B', version: '1.0.0' },
      { id: 'a', name: 'A', version: '1.0.0' },
      { id: 'c', name: 'C', version: '1.0.0' },
    ];

    expect(sortPluginsByOrder(plugins, ['c', 'a'])).toEqual([
      { id: 'c', name: 'C', version: '1.0.0' },
      { id: 'a', name: 'A', version: '1.0.0' },
      { id: 'b', name: 'B', version: '1.0.0' },
    ]);
  });
});

describe('buildFullPluginOrder', () => {
  it('appends untracked plugin ids after stored order', () => {
    expect(
      buildFullPluginOrder(['demo-plugin'], ['meilisearch', 'demo-plugin'])
    ).toEqual(['demo-plugin', 'meilisearch']);
  });
});

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

describe('resolvePluginAdminRoute', () => {
  it('returns null when no bundled plugin ships admin routes', () => {
    expect(resolvePluginAdminRoute('demo-plugin', '')).toBeNull();
    expect(resolvePluginAdminRoute('demo-plugin', 'missing')).toBeNull();
  });
});

describe('resolvePluginStorefrontRoute', () => {
  it('returns null when no storefront route matches', () => {
    expect(resolvePluginStorefrontRoute('demo-plugin', '')).toBeNull();
    expect(resolvePluginStorefrontRoute('demo-plugin', 'missing')).toBeNull();
    expect(resolvePluginStorefrontRoute('missing-plugin', '')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enable
// ---------------------------------------------------------------------------

describe('enable', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
    getDefaultSearchProviderId.mockReturnValue('db');
  });

  it('throws when pluginId is not registered', async () => {
    await expect(_enable('unregistered-plugin')).rejects.toThrow(
      /Plugin "unregistered-plugin" is not registered/
    );
  });

  it('registers hooks and marks the plugin enabled', async () => {
    const handler = vi.fn();
    const manifest = validPlugin({
      id: 'plugin-a',
      title: 'Plugin A',
      hooks: { 'order.created': handler },
    });
    register(manifest);

    await _enable('plugin-a');

    const entry = _registry.get('plugin-a');
    expect(entry.isEnabled).toBe(true);
    expect(entry.handlers.get('order.created')).toBe(handler);
  });

  it('registers before.* hooks with an attribution wrapper', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validPlugin({
      id: 'plugin-before',
      title: 'Plugin Before',
      hooks: {
        'before.shipment.create': () => {
          deny('Blocked', { code: 'HOLD_CHECK' });
        },
      },
    });
    register(manifest);

    await _enable('plugin-before');

    await expect(
      emitBefore('shipment.create', { orderId: 'order_1' })
    ).rejects.toMatchObject({
      code: 'HOLD_CHECK',
      pluginId: 'plugin-before',
      reason: 'Blocked',
    });

    _handlers.clear();
  });

  it('leaves an explicitly-set pluginId on HookAbortError untouched', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validPlugin({
      id: 'plugin-before-2',
      title: 'Plugin Before 2',
      hooks: {
        'before.shipment.ship': () => {
          deny('Blocked', { code: 'HOLD_CHECK', pluginId: 'custom-id' });
        },
      },
    });
    register(manifest);

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
    const manifest = validPlugin({
      id: 'plugin-b',
      title: 'Plugin B',
      onEnable,
    });
    register(manifest);

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
      validPlugin({
        id: 'plugin-payment',
        title: 'Plugin Payment',
        providers: {
          acme_pay: defineProvider('payment', {
            name: 'Acme Pay',
            createCheckoutSession: vi.fn(),
          }),
        },
      })
    );

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
      validPlugin({
        id: 'plugin-search',
        title: 'Plugin Search',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
        },
        onEnable,
      })
    );

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

  it('registers email providers into the email registry', async () => {
    getActiveEmailProviderId.mockReturnValue(null);

    register(
      validPlugin({
        id: 'plugin-email',
        title: 'Plugin Email',
        providers: {
          postmark: defineProvider('email', {
            name: 'Postmark',
            send: vi.fn(),
          }),
        },
      })
    );

    await _enable('plugin-email');

    expect(registerEmailProvider).toHaveBeenCalledOnce();
    const [providerId, provider, options] = registerEmailProvider.mock.calls[0];
    expect(providerId).toBe('postmark');
    expect(provider).toEqual({
      name: 'Postmark',
      send: expect.any(Function),
    });
    expect(options).toEqual({ isActive: true });
    expect(provider).not.toHaveProperty('type');
  });

  it('is idempotent — second call does nothing when already enabled', async () => {
    const handler = vi.fn();
    const manifest = validPlugin({
      id: 'plugin-c',
      title: 'Plugin C',
      hooks: { 'order.created': handler },
    });
    register(manifest);

    await _enable('plugin-c');
    await _enable('plugin-c');

    const entry = _registry.get('plugin-c');
    expect(entry.handlers.size).toBe(1);
  });

  it('is idempotent for plugins that only register providers', async () => {
    register(
      validPlugin({
        id: 'plugin-providers-only',
        title: 'Plugin Providers Only',
        providers: {
          meilisearch: defineProvider('search', {
            provider: { search: vi.fn() },
            isDefault: true,
          }),
        },
      })
    );

    await _enable('plugin-providers-only');
    await _enable('plugin-providers-only');

    expect(registerSearchProvider).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// disable
// ---------------------------------------------------------------------------

describe('disable', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
    getDefaultSearchProviderId.mockReturnValue('db');
  });

  it('throws when pluginId is not registered', async () => {
    await expect(_disable('unregistered-plugin')).rejects.toThrow(
      /Plugin "unregistered-plugin" is not registered/
    );
  });

  it('marks the plugin disabled and clears handlers', async () => {
    const manifest = validPlugin({ id: 'plugin-d', title: 'Plugin D' });
    register(manifest);

    await _disable('plugin-d');

    expect(_registry.get('plugin-d').isEnabled).toBe(false);
  });

  it('calls off() for each registered handler and clears handlers', async () => {
    const handler = vi.fn();
    const manifest = validPlugin({
      id: 'plugin-e',
      title: 'Plugin E',
      hooks: { 'order.created': handler },
    });
    register(manifest);

    await _enable('plugin-e');
    const wrappedHandler = _registry
      .get('plugin-e')
      .handlers.get('order.created');

    await _disable('plugin-e');

    const { _handlers } = await import('#/core/events/index.server');
    expect(_handlers.get('order.created') ?? []).not.toContain(wrappedHandler);
    expect(_registry.get('plugin-e').handlers.size).toBe(0);
  });

  it('deregisters wrapped before.* handlers so emitBefore runs no handler', async () => {
    const { deny, emitBefore, _handlers } =
      await import('#/core/events/index.server');

    const manifest = validPlugin({
      id: 'plugin-before-disable',
      title: 'Plugin Before Disable',
      hooks: {
        'before.shipment.create': () => {
          deny('Blocked');
        },
      },
    });
    register(manifest);

    await _enable('plugin-before-disable');
    await _disable('plugin-before-disable');

    await expect(
      emitBefore('shipment.create', { orderId: 'order_1' })
    ).resolves.toEqual({ orderId: 'order_1' });

    _handlers.clear();
  });

  it('calls onDisable(ctx) when present', async () => {
    const onDisable = vi.fn().mockResolvedValue(undefined);
    const manifest = validPlugin({
      id: 'plugin-f',
      title: 'Plugin F',
      onDisable,
    });
    register(manifest);

    await _disable('plugin-f');

    expect(onDisable).toHaveBeenCalledOnce();
    const ctx = onDisable.mock.calls[0][0];
    expect(ctx).toHaveProperty('plugin');
  });

  it('unregisters email providers on disable', async () => {
    register(
      validPlugin({
        id: 'plugin-email-disable',
        title: 'Plugin Email Disable',
        providers: {
          postmark: defineProvider('email', {
            name: 'Postmark',
            send: vi.fn(),
          }),
        },
      })
    );

    await _enable('plugin-email-disable');
    await _disable('plugin-email-disable');

    expect(unregisterEmailProvider).toHaveBeenCalledWith('postmark');
  });

  it('unregisters manifest providers and restores the previous search default', async () => {
    register(
      validPlugin({
        id: 'plugin-search-disable',
        title: 'Plugin Search Disable',
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

    await _enable('plugin-search-disable');
    vi.clearAllMocks();

    await _disable('plugin-search-disable');

    expect(unregisterSearchProvider).toHaveBeenCalledWith('meilisearch');
    expect(unregisterPaymentProvider).toHaveBeenCalledWith('acme_pay');
    expect(setDefaultSearchProvider).toHaveBeenCalledWith('db');
  });

  it('supports meilisearch-style manifests without manual lifecycle wiring', async () => {
    register({
      id: 'meilisearch-style',
      title: 'Meilisearch Style',
      version: '1.0.0',
      slug: 'meilisearch-style',
      providers: {
        meilisearch: defineProvider('search', {
          provider: { search: vi.fn() },
          isDefault: true,
        }),
      },
    });

    await _enable('meilisearch-style');

    expect(registerSearchProvider).toHaveBeenCalledWith(
      'meilisearch',
      expect.objectContaining({ search: expect.any(Function) }),
      { isDefault: true }
    );

    vi.clearAllMocks();

    await _disable('meilisearch-style');

    expect(unregisterSearchProvider).toHaveBeenCalledWith('meilisearch');
    expect(setDefaultSearchProvider).toHaveBeenCalledWith('db');
  });
});

describe('setPluginEnabledState email exclusivity', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
    getActiveEmailProviderId.mockReturnValue(null);
    settingsGet.mockResolvedValue([]);
  });

  it('disables sibling email provider plugins when activating another', async () => {
    register(
      validPlugin({
        id: '@bermooda/plugin-resend',
        title: 'Resend',
        slug: 'resend',
        providers: {
          resend: defineProvider('email', {
            name: 'Resend',
            send: vi.fn(),
          }),
        },
      })
    );
    register(
      validPlugin({
        id: '@bermooda/plugin-sendgrid',
        title: 'SendGrid',
        slug: 'sendgrid',
        providers: {
          sendgrid: defineProvider('email', {
            name: 'SendGrid',
            send: vi.fn(),
          }),
        },
      })
    );

    expect(pluginProvidesType('@bermooda/plugin-resend', 'email')).toBe(true);

    settingsGet.mockResolvedValue(['@bermooda/plugin-resend']);
    await _enable('@bermooda/plugin-resend');
    vi.clearAllMocks();
    settingsGet.mockResolvedValue(['@bermooda/plugin-resend']);

    await setPluginEnabledState('@bermooda/plugin-sendgrid', true);

    expect(unregisterEmailProvider).toHaveBeenCalledWith('resend');
    expect(registerEmailProvider).toHaveBeenCalledWith(
      'sendgrid',
      expect.objectContaining({ name: 'SendGrid' }),
      { isActive: true }
    );
    expect(settingsSet).toHaveBeenCalledWith(
      'enabledPlugins',
      expect.arrayContaining(['@bermooda/plugin-sendgrid'])
    );
    expect(settingsSet).toHaveBeenCalledWith(
      'enabledPlugins',
      expect.not.arrayContaining(['@bermooda/plugin-resend'])
    );
  });
});
