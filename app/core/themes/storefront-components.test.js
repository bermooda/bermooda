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
});
