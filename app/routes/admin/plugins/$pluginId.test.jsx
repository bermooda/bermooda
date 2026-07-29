import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientResolve,
  mockGetRegisteredPluginBySlug,
  mockServerResolve,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockClientResolve: vi.fn(),
  mockGetRegisteredPluginBySlug: vi.fn(),
  mockServerResolve: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
}));

vi.mock('#/core/plugins/admin-routes.client', () => ({
  resolvePluginAdminRoute: mockClientResolve,
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPluginBySlug: mockGetRegisteredPluginBySlug,
  resolvePluginAdminRoute: mockServerResolve,
}));

import AdminPluginDispatcher, {
  loader,
  meta,
} from '#/routes/admin/plugins/$pluginId';

const sampleManifest = {
  id: '@acme/demo-plugin',
  title: 'Demo Plugin',
  slug: 'demo-plugin',
};

describe('admin plugin dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegisteredPluginBySlug.mockReturnValue(sampleManifest);
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

    mockServerResolve.mockImplementation(() => ({
      path: '',
      loader: vi.fn().mockResolvedValue(pluginLoaderData),
    }));

    const result = await loader({
      request: new Request('http://localhost/admin/plugins/demo-plugin'),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith('demo-plugin');
    expect(mockServerResolve).toHaveBeenCalledWith('demo-plugin', '');
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: sampleManifest,
      splatPath: '',
      pluginLoaderData,
    });
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
});
