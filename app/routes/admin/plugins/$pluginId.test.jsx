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
    });
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
});
