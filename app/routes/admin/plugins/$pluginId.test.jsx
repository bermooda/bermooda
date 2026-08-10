import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientResolve,
  mockGetRegisteredPluginBySlug,
  mockLoadPluginSettings,
  mockSavePluginSettings,
  mockServerResolve,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockClientResolve: vi.fn(),
  mockGetRegisteredPluginBySlug: vi.fn(),
  mockLoadPluginSettings: vi.fn(),
  mockSavePluginSettings: vi.fn(),
  mockServerResolve: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
  useActionData: () => undefined,
  useNavigation: () => ({ state: 'idle' }),
  Form: ({ children, ...props }) => <form {...props}>{children}</form>,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('#/core/i18n', () => ({
  useT: () => (key) => key,
}));

vi.mock('#/core/plugins/admin-routes.client', () => ({
  resolvePluginAdminRoute: mockClientResolve,
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPluginBySlug: mockGetRegisteredPluginBySlug,
  loadPluginSettings: mockLoadPluginSettings,
  resolvePluginAdminRoute: mockServerResolve,
  savePluginSettings: mockSavePluginSettings,
}));

import AdminPluginDispatcher, {
  action,
  loader,
  meta,
} from '#/routes/admin/plugins/$pluginId';

const sampleManifest = {
  id: '@acme/demo-plugin',
  title: 'Demo Plugin',
  slug: 'demo-plugin',
};

/**
 * @param {unknown} error
 * @returns {asserts error is Response}
 */
function expectResponse(error) {
  expect(error).toBeInstanceOf(Response);
}

describe('admin plugin dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegisteredPluginBySlug.mockReturnValue(sampleManifest);
    mockLoadPluginSettings.mockResolvedValue({});
  });

  it('builds meta tags from the plugin id', () => {
    expect(
      meta({
        params: { pluginId: 'demo-plugin' },
      })
    ).toEqual([
      { title: 'Plugin: demo-plugin — Admin' },
      {
        name: 'description',
        content: 'Admin UI for plugin demo-plugin',
      },
    ]);
  });

  it('returns not-found when the plugin is not registered', async () => {
    mockGetRegisteredPluginBySlug.mockReturnValue(null);

    const result = await loader({
      request: new Request('http://localhost/admin/plugins/missing'),
      params: { 'pluginId': 'missing', '*': '' },
    });

    expect(result).toEqual({
      status: 'not-found',
      pluginId: 'missing',
    });
  });

  it('returns no-admin-routes when the plugin has no admin pages', async () => {
    mockGetRegisteredPluginBySlug.mockReturnValue({
      id: '@acme/hold-check',
      title: 'Hold Check',
      slug: 'hold-check',
    });
    mockServerResolve.mockReturnValue(null);

    const result = await loader({
      request: new Request('http://localhost/admin/plugins/hold-check'),
      params: { 'pluginId': 'hold-check', '*': '' },
    });

    expect(result).toMatchObject({
      status: 'no-admin-routes',
      pluginId: 'hold-check',
      manifest: { id: '@acme/hold-check', title: 'Hold Check' },
    });
  });

  it('returns ok with settings when plugin has settings but no admin routes', async () => {
    const manifest = {
      id: '@acme/settings-only',
      title: 'Settings Only',
      slug: 'settings-only',
      settings: [{ key: 'host', label: 'Host', type: 'text' }],
    };
    mockGetRegisteredPluginBySlug.mockReturnValue(manifest);
    mockServerResolve.mockReturnValue(null);
    mockLoadPluginSettings.mockResolvedValue({ host: 'localhost' });

    const result = await loader({
      request: new Request('http://localhost/admin/plugins/settings-only'),
      params: { 'pluginId': 'settings-only', '*': '' },
    });

    expect(mockLoadPluginSettings).toHaveBeenCalledWith(manifest);
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'settings-only',
      manifest,
      splatPath: '',
      pluginSettings: { host: 'localhost' },
      pluginLoaderData: null,
    });
  });

  it('returns no-match when the splat path does not resolve', async () => {
    mockServerResolve.mockImplementation((_pluginSlug, path) =>
      path === '' ? { path: '' } : null
    );

    const result = await loader({
      request: new Request(
        'http://localhost/admin/plugins/demo-plugin/reports'
      ),
      params: { 'pluginId': 'demo-plugin', '*': 'reports' },
    });

    expect(result).toMatchObject({
      status: 'no-match',
      pluginId: 'demo-plugin',
      splatPath: 'reports',
    });
  });

  it('uses the splat path and returns loader data for a matched plugin route', async () => {
    const pluginLoaderData = { events: [{ orderId: 'order_1' }] };
    const pluginLoader = vi.fn().mockResolvedValue(pluginLoaderData);

    mockServerResolve.mockImplementation(() => ({
      path: 'orders/:id',
      params: { id: 'order_1' },
      loader: pluginLoader,
    }));

    const request = new Request(
      'http://localhost/admin/plugins/demo-plugin/orders/order_1'
    );
    const params = { 'pluginId': 'demo-plugin', '*': 'orders/order_1' };

    const result = await loader({ request, params });

    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith('demo-plugin');
    expect(mockServerResolve).toHaveBeenCalledWith(
      'demo-plugin',
      'orders/order_1'
    );
    expect(pluginLoader).toHaveBeenCalledWith({
      request,
      params: {
        'pluginId': 'demo-plugin',
        '*': 'orders/order_1',
        'id': 'order_1',
      },
    });
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: sampleManifest,
      splatPath: 'orders/order_1',
      pluginLoaderData,
      pluginSettings: {},
    });
  });

  it('saves settings via intent=save-settings without requiring a plugin action', async () => {
    const manifest = {
      id: '@acme/demo-plugin',
      title: 'Demo Plugin',
      slug: 'demo-plugin',
      settings: [{ key: 'host', type: 'text' }],
    };
    mockGetRegisteredPluginBySlug.mockReturnValue(manifest);
    mockSavePluginSettings.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set('intent', 'save-settings');
    formData.set('pluginId', '@acme/demo-plugin');
    formData.set('host', 'example.com');

    const result = await action({
      request: new Request('http://localhost/admin/plugins/demo-plugin', {
        method: 'POST',
        body: formData,
      }),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(mockSavePluginSettings).toHaveBeenCalledWith(
      manifest.id,
      manifest,
      expect.any(FormData)
    );
    expect(result).toEqual({
      success: true,
      intent: 'save-settings',
      savedSettings: '@acme/demo-plugin',
    });
    expect(mockServerResolve).not.toHaveBeenCalled();
  });

  it('returns Missing pluginId when pluginId is absent on save-settings', async () => {
    const manifest = {
      id: '@acme/demo-plugin',
      title: 'Demo Plugin',
      slug: 'demo-plugin',
      settings: [{ key: 'host', type: 'text' }],
    };
    mockGetRegisteredPluginBySlug.mockReturnValue(manifest);

    const formData = new FormData();
    formData.set('intent', 'save-settings');
    formData.set('host', 'example.com');

    const result = await action({
      request: new Request('http://localhost/admin/plugins/demo-plugin', {
        method: 'POST',
        body: formData,
      }),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(result).toEqual({
      error: 'Missing pluginId',
      intent: 'save-settings',
    });
    expect(mockSavePluginSettings).not.toHaveBeenCalled();
  });

  it('returns Missing pluginId when pluginId does not match manifest.id', async () => {
    const manifest = {
      id: '@acme/demo-plugin',
      title: 'Demo Plugin',
      slug: 'demo-plugin',
      settings: [{ key: 'host', type: 'text' }],
    };
    mockGetRegisteredPluginBySlug.mockReturnValue(manifest);

    const formData = new FormData();
    formData.set('intent', 'save-settings');
    formData.set('pluginId', '@acme/other-plugin');
    formData.set('host', 'example.com');

    const result = await action({
      request: new Request('http://localhost/admin/plugins/demo-plugin', {
        method: 'POST',
        body: formData,
      }),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(result).toEqual({
      error: 'Missing pluginId',
      intent: 'save-settings',
    });
    expect(mockSavePluginSettings).not.toHaveBeenCalled();
  });

  it('returns No settings for plugin when manifest has no settings schema', async () => {
    mockGetRegisteredPluginBySlug.mockReturnValue(sampleManifest);

    const formData = new FormData();
    formData.set('intent', 'save-settings');
    formData.set('pluginId', sampleManifest.id);

    const result = await action({
      request: new Request('http://localhost/admin/plugins/demo-plugin', {
        method: 'POST',
        body: formData,
      }),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(result).toEqual({
      error: 'No settings for plugin',
      intent: 'save-settings',
    });
    expect(mockSavePluginSettings).not.toHaveBeenCalled();
  });

  it('invokes the matched descriptor action on POST', async () => {
    const pluginAction = vi.fn().mockResolvedValue({ saved: true });
    mockServerResolve.mockReturnValue({
      path: 'files/*',
      params: { splat: 'a/b' },
      action: pluginAction,
    });

    const request = new Request(
      'http://localhost/admin/plugins/demo-plugin/files/a/b',
      { method: 'POST' }
    );
    const params = { 'pluginId': 'demo-plugin', '*': 'files/a/b' };

    const result = await action({ request, params });

    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith('demo-plugin');
    expect(mockServerResolve).toHaveBeenCalledWith('demo-plugin', 'files/a/b');
    expect(pluginAction).toHaveBeenCalledWith({
      request,
      params: {
        'pluginId': 'demo-plugin',
        '*': 'files/a/b',
        'splat': 'a/b',
      },
    });
    expect(result).toEqual({ saved: true });
  });

  it('throws 404 when the plugin is not registered on action', async () => {
    mockGetRegisteredPluginBySlug.mockReturnValue(null);

    try {
      await action({
        request: new Request('http://localhost/admin/plugins/missing', {
          method: 'POST',
        }),
        params: { 'pluginId': 'missing', '*': '' },
      });
      expect.unreachable('expected action to throw');
    } catch (error) {
      expectResponse(error);
      expect(error.status).toBe(404);
    }

    expect(mockServerResolve).not.toHaveBeenCalled();
  });

  it('throws 405 when the matched route has no action', async () => {
    mockServerResolve.mockReturnValue({
      path: '',
      loader: vi.fn(),
    });

    try {
      await action({
        request: new Request('http://localhost/admin/plugins/demo-plugin', {
          method: 'POST',
        }),
        params: { 'pluginId': 'demo-plugin', '*': '' },
      });
      expect.unreachable('expected action to throw');
    } catch (error) {
      expectResponse(error);
      expect(error.status).toBe(405);
    }
  });

  it('throws 405 when no route descriptor matches on action', async () => {
    mockServerResolve.mockReturnValue(null);

    try {
      await action({
        request: new Request(
          'http://localhost/admin/plugins/demo-plugin/missing',
          { method: 'POST' }
        ),
        params: { 'pluginId': 'demo-plugin', '*': 'missing' },
      });
      expect.unreachable('expected action to throw');
    } catch (error) {
      expectResponse(error);
      expect(error.status).toBe(405);
    }
  });

  it('renders the resolved admin component with loader data', () => {
    function MockPluginPage({ loaderData }) {
      return <div>Events: {loaderData.events.length}</div>;
    }

    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: { title: 'Demo Plugin' },
      splatPath: '',
      pluginLoaderData: { events: [{ orderId: 'order_1' }] },
    });
    mockClientResolve.mockReturnValue({
      path: '',
      Component: MockPluginPage,
    });

    const html = renderToStaticMarkup(<AdminPluginDispatcher />);

    expect(html).toContain('Events: 1');
  });

  it('renders settings form above the plugin component on root', () => {
    function MockPluginPage() {
      return <div>Custom Admin</div>;
    }

    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: {
        id: '@acme/demo-plugin',
        title: 'Demo Plugin',
        version: '1.0.0',
        settings: [{ key: 'host', label: 'Host', type: 'text' }],
      },
      splatPath: '',
      pluginLoaderData: null,
      pluginSettings: { host: 'localhost' },
    });
    mockClientResolve.mockReturnValue({
      path: '',
      Component: MockPluginPage,
    });

    const html = renderToStaticMarkup(<AdminPluginDispatcher />);

    expect(html).toContain('Demo Plugin');
    expect(html).toContain('name="host"');
    expect(html).toContain('Custom Admin');
    expect(html.indexOf('name="host"')).toBeLessThan(
      html.indexOf('Custom Admin')
    );
  });

  it('does not render settings form on nested splat paths', () => {
    function MockPluginPage() {
      return <div>Nested Page</div>;
    }

    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: {
        id: '@acme/demo-plugin',
        title: 'Demo Plugin',
        version: '1.0.0',
        settings: [{ key: 'host', type: 'text' }],
      },
      splatPath: 'reports',
      pluginLoaderData: {},
      pluginSettings: {},
    });
    mockClientResolve.mockReturnValue({
      path: 'reports',
      Component: MockPluginPage,
    });

    const html = renderToStaticMarkup(<AdminPluginDispatcher />);

    expect(html).toContain('Nested Page');
    expect(html).not.toContain('name="host"');
  });

  it('renders settings form with PageHeader for settings-only plugins', () => {
    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'settings-only',
      manifest: {
        id: '@acme/settings-only',
        title: 'Settings Only',
        version: '2.0.0',
        settings: [{ key: 'host', label: 'Host', type: 'text' }],
      },
      splatPath: '',
      pluginLoaderData: null,
      pluginSettings: { host: 'localhost' },
    });
    mockClientResolve.mockReturnValue(null);

    const html = renderToStaticMarkup(<AdminPluginDispatcher />);

    expect(html).toContain('Settings Only');
    expect(html).toContain('v2.0.0 · @acme/settings-only');
    expect(html).toContain('name="host"');
    expect(html).not.toContain('admin.plugins.detail.noAdminPagesForPath');
    expect(html).not.toContain('admin.plugins.detail.noAdminPages');
  });
});
