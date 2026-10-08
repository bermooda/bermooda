import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __registerLazyThemesFrom,
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

describe('registerStorefrontTheme', () => {
  it('indexes the theme by package id and slug', () => {
    registerStorefrontTheme(TEST_THEME);

    expect(getStorefrontComponent('Layout', '@bermooda/theme-test')).toBe(
      StubPage
    );
    expect(getStorefrontComponent('Layout', 'test')).toBe(StubPage);
  });
});

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

describe('lazy theme loading (browser)', () => {
  /**
   * @param {string} slug
   * @param {() => Promise<{ default?: unknown }>} load
   */
  function registerLazyTheme(slug, load) {
    __registerLazyThemesFrom(
      { [`/app/themes/${slug}/index.js`]: load },
      {
        [`/app/themes/${slug}/package.json`]: {
          name: `@bermooda/theme-${slug}`,
          version: '1.0.0',
          bermooda: { title: slug, slug, engine: '>=0.1.0' },
        },
      }
    );
  }

  /** @param {{ name: string, themeId: string }} props */
  function Probe({ name, themeId }) {
    const Component = getStorefrontComponent(name, themeId);
    return Component ? <Component /> : <p>missing</p>;
  }

  function LazyHome() {
    return <p>lazy home</p>;
  }

  it('suspends until the theme chunk loads, then resolves by id and slug', async () => {
    let resolveLoad;
    const load = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLoad = () =>
            resolve({ default: { components: { HomePage: LazyHome } } });
        })
    );
    registerLazyTheme('lazy', load);

    // React only processes the Suspense retry inside an async act().
    await act(async () => {
      render(
        <Suspense fallback={<p>loading</p>}>
          <Probe name="HomePage" themeId="@bermooda/theme-lazy" />
          <Probe name="HomePage" themeId="lazy" />
        </Suspense>
      );
    });
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => resolveLoad());
    expect(screen.getAllByText('lazy home')).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
    // Once loaded, lookups are synchronous (no `use`, works outside render).
    expect(getStorefrontComponent('HomePage', 'lazy')).toBe(LazyHome);
    expect(getStorefrontComponent('CartPage', 'lazy')).toBeNull();
  });

  it('resolves to null when the loaded theme package is malformed', async () => {
    __registerLazyThemesFrom(
      { '/app/themes/broken/index.js': async () => ({ default: {} }) },
      { '/app/themes/broken/package.json': { name: '@bermooda/theme-broken' } }
    );

    await act(async () => {
      render(
        <Suspense fallback={<p>loading</p>}>
          <Probe name="HomePage" themeId="@bermooda/theme-broken" />
        </Suspense>
      );
    });

    expect(screen.getByText('missing')).toBeInTheDocument();
  });

  it('returns null without loading anything for an unknown theme', () => {
    expect(
      getStorefrontComponent('HomePage', '@bermooda/theme-nope')
    ).toBeNull();
  });
});
