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
  id: '@bermooda/sample-analytics',
  title: 'Sample Analytics',
  slug: 'sample-analytics',
};

describe('admin plugin dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegisteredPluginBySlug.mockReturnValue(sampleManifest);
  });

  it('builds meta tags from the plugin id', () => {
    expect(
      meta({
        params: { pluginId: 'sample-analytics' },
      })
    ).toEqual([
      { title: 'Plugin: sample-analytics — Admin' },
      {
        name: 'description',
        content: 'Admin UI for plugin sample-analytics',
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
      id: '@bermooda/fraud-guard',
      title: 'Fraud Guard',
      slug: 'fraud-guard',
    });
    mockServerResolve.mockReturnValue(null);

    const result = await loader({
      request: new Request('http://localhost/admin/plugins/fraud-guard'),
      params: { 'pluginId': 'fraud-guard', '*': '' },
    });

    expect(result).toMatchObject({
      status: 'no-admin-routes',
      pluginId: 'fraud-guard',
      manifest: { id: '@bermooda/fraud-guard', title: 'Fraud Guard' },
    });
  });

  it('returns no-match when the splat path does not resolve', async () => {
    mockServerResolve.mockImplementation((_pluginSlug, path) =>
      path === '' ? { path: '' } : null
    );

    const result = await loader({
      request: new Request(
        'http://localhost/admin/plugins/sample-analytics/reports'
      ),
      params: { 'pluginId': 'sample-analytics', '*': 'reports' },
    });

    expect(result).toMatchObject({
      status: 'no-match',
      pluginId: 'sample-analytics',
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
      request: new Request('http://localhost/admin/plugins/sample-analytics'),
      params: { 'pluginId': 'sample-analytics', '*': '' },
    });

    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith(
      'sample-analytics'
    );
    expect(mockServerResolve).toHaveBeenCalledWith('sample-analytics', '');
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'sample-analytics',
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
      pluginId: 'sample-analytics',
      manifest: { title: 'Sample Analytics' },
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
