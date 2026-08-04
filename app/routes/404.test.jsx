import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetStorefrontComponent,
  mockLoadStorefrontPageContext,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockGetStorefrontComponent: vi.fn(),
  mockLoadStorefrontPageContext: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
}));

vi.mock('#/core/storefront/page-context.server', () => ({
  loadStorefrontPageContext: mockLoadStorefrontPageContext,
}));

vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: mockGetStorefrontComponent,
}));

import NotFoundRoute, { loader, meta } from '#/routes/404';

describe('404 route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadStorefrontPageContext.mockResolvedValue({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: {},
    });
  });

  it('builds not-found meta tags', () => {
    expect(meta()).toEqual([
      { title: '404 - Page Not Found' },
      {
        name: 'description',
        content: 'The page you are looking for does not exist.',
      },
    ]);
  });

  it('returns theme page context from the loader', async () => {
    const result = await loader({
      request: new Request('http://localhost/missing'),
    });

    expect(mockLoadStorefrontPageContext).toHaveBeenCalledOnce();
    expect(result).toEqual({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: {},
    });
  });

  it('renders NotFoundPage without wrapping Layout in the route', () => {
    function MockNotFoundPage(props) {
      return (
        <div data-testid="not-found-page">
          locale:{props.locale} currency:{props.currency}
        </div>
      );
    }

    mockGetStorefrontComponent.mockImplementation((name) => {
      if (name === 'NotFoundPage') return MockNotFoundPage;
      if (name === 'Layout') {
        return function UnexpectedLayout({ children }) {
          return <div data-testid="route-owned-layout">{children}</div>;
        };
      }
      return null;
    });

    mockUseLoaderData.mockReturnValue({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: {},
    });

    const html = renderToStaticMarkup(<NotFoundRoute />);

    expect(mockGetStorefrontComponent).toHaveBeenCalledWith(
      'NotFoundPage',
      'default'
    );
    expect(mockGetStorefrontComponent).not.toHaveBeenCalledWith(
      'Layout',
      'default'
    );
    expect(html).toContain('data-testid="not-found-page"');
    expect(html).toContain('locale:en');
    expect(html).toContain('currency:USD');
    expect(html).not.toContain('data-testid="route-owned-layout"');
  });

  it('throws when NotFoundPage is missing from the theme', () => {
    mockGetStorefrontComponent.mockReturnValue(null);
    mockUseLoaderData.mockReturnValue({ themeId: 'default' });

    expect(() => renderToStaticMarkup(<NotFoundRoute />)).toThrow(
      'NotFoundPage theme component not found'
    );
  });
});
