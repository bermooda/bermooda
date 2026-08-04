import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/catalog/index.server', () => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
}));

vi.mock('#/core/storefront/page-context.server', () => ({
  loadStorefrontPageContext: vi.fn().mockResolvedValue({
    themeId: 'default',
    locale: 'en',
    currency: 'USD',
    themeSettings: {},
  }),
}));

vi.mock('#/core/reviews/index.server', () => ({
  attachReviewSummaries: vi.fn(async (products) => products),
}));

vi.mock('#/core/seo/index.server', () => ({
  buildOrganizationJsonLd: vi
    .fn()
    .mockResolvedValue({ '@type': 'Organization' }),
  buildSiteMeta: vi.fn().mockResolvedValue([{ title: 'bermooda' }]),
  buildWebSiteJsonLd: vi.fn().mockResolvedValue({ '@type': 'WebSite' }),
}));

vi.mock('#/core/themes/index.server', () => ({
  getSlotBlocksMap: vi.fn(),
}));

vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: vi.fn(() => () => null),
}));

import { listCategories, listProducts } from '#/core/catalog/index.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';

import { loader } from '#/routes/storefront';

describe('storefront home loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStorefrontPageContext.mockResolvedValue({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: {},
    });
  });

  it('loads slot block maps for the home hero and featured slots', async () => {
    listProducts.mockResolvedValue({ products: [{ id: 'prod_1' }] });
    listCategories.mockResolvedValue([{ id: 'cat_1', title: 'Dining' }]);
    getSlotBlocksMap.mockResolvedValue({
      'home.hero': [{ pluginId: 'hero-plugin', component: () => null }],
      'home.featured': [{ pluginId: 'featured-plugin', component: () => null }],
    });

    const data = await loader({
      request: new Request('http://localhost/'),
    });

    expect(getSlotBlocksMap).toHaveBeenCalledWith([
      'home.hero',
      'home.featured',
    ]);
    expect(data.slotBlocks).toEqual({
      'home.hero': [
        { pluginId: 'hero-plugin', component: expect.any(Function) },
      ],
      'home.featured': [
        { pluginId: 'featured-plugin', component: expect.any(Function) },
      ],
    });
    expect(data.themeSettings).toEqual({});
  });

  it('forwards themeSettings from page context to the home page props', async () => {
    loadStorefrontPageContext.mockResolvedValue({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: { accentColor: '#111' },
    });
    listProducts.mockResolvedValue({ products: [] });
    listCategories.mockResolvedValue([]);
    getSlotBlocksMap.mockResolvedValue({});

    const data = await loader({
      request: new Request('http://localhost/'),
    });

    expect(data.themeSettings).toEqual({ accentColor: '#111' });
  });
});
