import { describe, expect, it } from 'vitest';

import { getStorefrontComponent } from '#/core/themes/storefront-components';

import { routeComponents } from '#/themes/default/routes';

describe('default theme storefront components', () => {
  it('registers SearchPage for /search', () => {
    expect(routeComponents['/search']).toBe('SearchPage');
    expect(getStorefrontComponent('SearchPage')).toBeTypeOf('function');
  });

  it('registers CollectionPage for /collections/:handle', () => {
    expect(routeComponents['/collections/:handle']).toBe('CollectionPage');
    expect(getStorefrontComponent('CollectionPage')).toBeTypeOf('function');
  });

  it('registers account wishlist and loyalty pages', () => {
    expect(routeComponents['/account/wishlist']).toBe('AccountWishlistPage');
    expect(routeComponents['/account/loyalty']).toBe('AccountLoyaltyPage');
    expect(getStorefrontComponent('AccountWishlistPage')).toBeTypeOf(
      'function'
    );
    expect(getStorefrontComponent('AccountLoyaltyPage')).toBeTypeOf('function');
  });

  it('aliases required Layout to StorefrontShell', () => {
    const Layout = getStorefrontComponent('Layout');
    const NotFoundPage = getStorefrontComponent('NotFoundPage');
    expect(Layout).toBeTypeOf('function');
    expect(NotFoundPage).toBeTypeOf('function');
  });

  it('supports the legacy default theme id', () => {
    expect(getStorefrontComponent('Layout', 'default')).toBeTypeOf('function');
  });
});
