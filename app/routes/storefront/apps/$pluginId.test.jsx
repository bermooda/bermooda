import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientResolve,
  mockGetRegisteredPluginBySlug,
  mockIsPluginEnabled,
  mockLoadStorefrontPageContext,
  mockServerResolve,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockClientResolve: vi.fn(),
  mockGetRegisteredPluginBySlug: vi.fn(),
  mockIsPluginEnabled: vi.fn(),
  mockLoadStorefrontPageContext: vi.fn(),
  mockServerResolve: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
}));

vi.mock('#/core/plugins/storefront-routes.client', () => ({
  resolvePluginStorefrontRoute: mockClientResolve,
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPluginBySlug: mockGetRegisteredPluginBySlug,
  isPluginEnabled: mockIsPluginEnabled,
  resolvePluginStorefrontRoute: mockServerResolve,
}));

vi.mock('#/core/storefront/page-context.server', () => ({
  loadStorefrontPageContext: mockLoadStorefrontPageContext,
}));

vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: vi.fn((_name, _themeId) => {
    function MockLayout({ children }) {
      return <div data-testid="storefront-shell">{children}</div>;
    }
    return MockLayout;
  }),
}));

import StorefrontPluginDispatcher, {
  action,
  loader,
  meta,
} from '#/routes/storefront/apps/$pluginId';

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

describe('storefront plugin dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadStorefrontPageContext.mockResolvedValue({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
    });
    mockGetRegisteredPluginBySlug.mockReturnValue(sampleManifest);
    mockIsPluginEnabled.mockResolvedValue(true);
  });

  it('builds meta tags from the resolved plugin manifest', () => {
    expect(
      meta({
        loaderData: {
          status: 'ok',
          manifest: { title: 'Demo Plugin' },
        },
        params: { pluginId: 'demo-plugin' },
      })
    ).toEqual([
      { title: 'Demo Plugin — Storefront' },
      {
        name: 'description',
        content: 'Storefront page for plugin Demo Plugin',
      },
    ]);
  });

  it('uses the splat path and returns loader data for a matched plugin route', async () => {
    const pluginLoaderData = { eventCount: 3 };
    const pluginLoader = vi.fn().mockResolvedValue(pluginLoaderData);

    mockServerResolve.mockImplementation((_pluginSlug, path) => ({
      path,
      params: path === 'reports/daily' ? { report: 'daily' } : {},
      loader: pluginLoader,
    }));

    const request = new Request('http://localhost/apps/demo-plugin/wrong-path');
    const params = {
      'pluginId': 'demo-plugin',
      '*': 'reports/daily',
    };

    const result = await loader({ request, params });

    expect(mockLoadStorefrontPageContext).toHaveBeenCalledOnce();
    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith('demo-plugin');
    expect(mockIsPluginEnabled).toHaveBeenCalledWith('@acme/demo-plugin');
    expect(mockServerResolve).toHaveBeenCalledWith(
      'demo-plugin',
      'reports/daily'
    );
    expect(pluginLoader).toHaveBeenCalledWith({
      request,
      params: {
        'pluginId': 'demo-plugin',
        '*': 'reports/daily',
        'report': 'daily',
      },
    });
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: sampleManifest,
      splatPath: 'reports/daily',
      pluginLoaderData,
      themeId: 'default',
    });
  });

  it('returns a disabled state when the plugin is not enabled', async () => {
    mockIsPluginEnabled.mockResolvedValue(false);

    const result = await loader({
      request: new Request('http://localhost/apps/demo-plugin'),
      params: { 'pluginId': 'demo-plugin', '*': '' },
    });

    expect(result).toMatchObject({
      status: 'disabled',
      pluginId: 'demo-plugin',
      themeId: 'default',
    });
  });

  it('invokes the matched descriptor action on POST', async () => {
    const pluginAction = vi.fn().mockResolvedValue({ ok: true });
    mockServerResolve.mockReturnValue({
      path: 'orders/:id',
      params: { id: 'abc' },
      action: pluginAction,
    });

    const request = new Request(
      'http://localhost/apps/demo-plugin/orders/abc',
      { method: 'POST' }
    );
    const params = {
      'pluginId': 'demo-plugin',
      '*': 'orders/abc',
    };

    const result = await action({ request, params });

    expect(mockGetRegisteredPluginBySlug).toHaveBeenCalledWith('demo-plugin');
    expect(mockIsPluginEnabled).toHaveBeenCalledWith('@acme/demo-plugin');
    expect(mockServerResolve).toHaveBeenCalledWith('demo-plugin', 'orders/abc');
    expect(pluginAction).toHaveBeenCalledWith({
      request,
      params: {
        'pluginId': 'demo-plugin',
        '*': 'orders/abc',
        'id': 'abc',
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('throws 404 when the plugin is not registered on action', async () => {
    mockGetRegisteredPluginBySlug.mockReturnValue(null);

    try {
      await action({
        request: new Request('http://localhost/apps/missing', {
          method: 'POST',
        }),
        params: { 'pluginId': 'missing', '*': '' },
      });
      expect.unreachable('expected action to throw');
    } catch (error) {
      expectResponse(error);
      expect(error.status).toBe(404);
    }
  });

  it('throws 404 when the plugin is disabled on action', async () => {
    mockIsPluginEnabled.mockResolvedValue(false);

    try {
      await action({
        request: new Request('http://localhost/apps/demo-plugin', {
          method: 'POST',
        }),
        params: { 'pluginId': 'demo-plugin', '*': '' },
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
        request: new Request('http://localhost/apps/demo-plugin', {
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
        request: new Request('http://localhost/apps/demo-plugin/missing', {
          method: 'POST',
        }),
        params: { 'pluginId': 'demo-plugin', '*': 'missing' },
      });
      expect.unreachable('expected action to throw');
    } catch (error) {
      expectResponse(error);
      expect(error.status).toBe(405);
    }
  });

  it('renders the resolved storefront component inside the storefront shell', () => {
    function MockPluginPage({ loaderData }) {
      return <div>Event count: {loaderData.eventCount}</div>;
    }

    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'demo-plugin',
      manifest: { title: 'Demo Plugin' },
      splatPath: '',
      pluginLoaderData: { eventCount: 7 },
      themeId: 'default',
    });
    mockClientResolve.mockReturnValue({
      path: '',
      Component: MockPluginPage,
    });

    const html = renderToStaticMarkup(<StorefrontPluginDispatcher />);

    expect(html).toContain('data-testid="storefront-shell"');
    expect(html).toContain('Event count: 7');
  });
});
