import { beforeEach, describe, expect, it } from 'vitest';

import {
  getStorefrontComponent,
  registerStorefrontTheme,
} from '#/core/themes/storefront-components';

function StubPage() {
  return null;
}

const TEST_THEME = {
  id: '@bermooda/theme-test',
  slug: 'test',
  title: 'Test',
  version: '1.0.0',
  components: {
    Layout: StubPage,
    SearchPage: StubPage,
    CollectionPage: StubPage,
    AccountWishlistPage: StubPage,
    AccountLoyaltyPage: StubPage,
    NotFoundPage: StubPage,
  },
};

describe('getStorefrontComponent', () => {
  beforeEach(() => {
    registerStorefrontTheme(TEST_THEME);
  });

  it('resolves components from a registered theme by package id', () => {
    expect(getStorefrontComponent('Layout', '@bermooda/theme-test')).toBe(
      StubPage
    );
    expect(getStorefrontComponent('SearchPage', '@bermooda/theme-test')).toBe(
      StubPage
    );
    expect(
      getStorefrontComponent('CollectionPage', '@bermooda/theme-test')
    ).toBe(StubPage);
    expect(
      getStorefrontComponent('AccountWishlistPage', '@bermooda/theme-test')
    ).toBe(StubPage);
    expect(
      getStorefrontComponent('AccountLoyaltyPage', '@bermooda/theme-test')
    ).toBe(StubPage);
    expect(getStorefrontComponent('NotFoundPage', '@bermooda/theme-test')).toBe(
      StubPage
    );
  });

  it('resolves components by theme slug alias', () => {
    expect(getStorefrontComponent('Layout', 'test')).toBe(StubPage);
  });

  it('returns null when themeId is omitted or unknown', () => {
    expect(getStorefrontComponent('Layout')).toBeNull();
    expect(getStorefrontComponent('Layout', '@missing/theme')).toBeNull();
  });

  it('returns null for an unknown component name', () => {
    expect(
      getStorefrontComponent('DoesNotExist', '@bermooda/theme-test')
    ).toBeNull();
  });
});
