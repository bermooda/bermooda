import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientResolve,
  mockPreloadStorefrontTheme,
  mockServerResolve,
  mockSettingsGet,
  mockUseLoaderData,
  mockRegistry,
} = vi.hoisted(() => ({
  mockClientResolve: vi.fn(),
  mockPreloadStorefrontTheme: vi.fn(),
  mockServerResolve: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockUseLoaderData: vi.fn(),
  mockRegistry: new Map(),
}));

vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
}));

vi.mock('#/core/plugins/storefront-routes.client', () => ({
  resolvePluginStorefrontRoute: mockClientResolve,
}));

vi.mock('#/core/plugins/index.server', () => ({
  _registry: mockRegistry,
  resolvePluginStorefrontRoute: mockServerResolve,
}));

vi.mock('#/core/settings/index.server', () => ({
  get: mockSettingsGet,
}));

vi.mock('#/core/themes/resolve.server', () => ({
  preloadStorefrontTheme: mockPreloadStorefrontTheme,
}));

vi.mock('#/themes/default/components/storefront-chrome', () => ({
  default: function MockStorefrontShell({ children }) {
    return <div data-testid="storefront-shell">{children}</div>;
  },
}));

import StorefrontPluginDispatcher, {
  loader,
  meta,
} from '#/routes/storefront/apps/$pluginId';

describe('storefront plugin dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.clear();
    mockPreloadStorefrontTheme.mockResolvedValue('default');
    mockSettingsGet.mockResolvedValue(['sample-analytics']);
  });

  it('builds meta tags from the resolved plugin manifest', () => {
    expect(
      meta({
        loaderData: {
          status: 'ok',
          manifest: { name: 'Sample Analytics' },
        },
        params: { pluginId: 'sample-analytics' },
      })
    ).toEqual([
      { title: 'Sample Analytics — Storefront' },
      {
        name: 'description',
        content: 'Storefront page for plugin Sample Analytics',
      },
    ]);
  });

  it('uses the splat path and returns loader data for a matched plugin route', async () => {
    const pluginLoaderData = { eventCount: 3 };

    mockRegistry.set('sample-analytics', {
      manifest: {
        id: 'sample-analytics',
        name: 'Sample Analytics',
        storefrontRoutes: '#/plugins/sample-analytics/storefront/routes.server',
      },
    });
    mockServerResolve.mockReturnValue({
      path: 'reports/daily',
      loader: vi.fn().mockResolvedValue(pluginLoaderData),
    });

    const result = await loader({
      request: new Request('http://localhost/apps/sample-analytics/wrong-path'),
      params: {
        'pluginId': 'sample-analytics',
        '*': 'reports/daily',
      },
    });

    expect(mockPreloadStorefrontTheme).toHaveBeenCalledOnce();
    expect(mockServerResolve).toHaveBeenCalledWith(
      'sample-analytics',
      'reports/daily'
    );
    expect(result).toMatchObject({
      status: 'ok',
      pluginId: 'sample-analytics',
      splatPath: 'reports/daily',
      pluginLoaderData,
      themeId: 'default',
    });
  });

  it('returns a disabled state when the plugin is not enabled', async () => {
    mockRegistry.set('sample-analytics', {
      manifest: {
        id: 'sample-analytics',
        name: 'Sample Analytics',
        storefrontRoutes: '#/plugins/sample-analytics/storefront/routes.server',
      },
    });
    mockSettingsGet.mockResolvedValue([]);

    const result = await loader({
      request: new Request('http://localhost/apps/sample-analytics'),
      params: { 'pluginId': 'sample-analytics', '*': '' },
    });

    expect(result).toMatchObject({
      status: 'disabled',
      pluginId: 'sample-analytics',
      themeId: 'default',
    });
  });

  it('renders the resolved storefront component inside the storefront shell', () => {
    function MockPluginPage({ loaderData }) {
      return <div>Event count: {loaderData.eventCount}</div>;
    }

    mockUseLoaderData.mockReturnValue({
      status: 'ok',
      pluginId: 'sample-analytics',
      manifest: { name: 'Sample Analytics' },
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
