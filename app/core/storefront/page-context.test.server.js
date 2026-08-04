import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/currency/index.server', () => ({
  getRequestCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('#/core/i18n/index.server', () => ({
  getRequestLocale: vi.fn().mockResolvedValue('en'),
}));

vi.mock('#/core/themes/index.server', () => ({
  preloadStorefrontTheme: vi.fn().mockResolvedValue('default'),
  getRegisteredTheme: vi.fn().mockReturnValue(null),
  loadThemeSettings: vi.fn().mockResolvedValue({}),
}));

import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  loadStorefrontPageContext,
  parseReturnTo,
} from '#/core/storefront/page-context.server';
import {
  getRegisteredTheme,
  loadThemeSettings,
  preloadStorefrontTheme,
} from '#/core/themes/index.server';

describe('storefront page context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preloadStorefrontTheme.mockResolvedValue('default');
    getRegisteredTheme.mockReturnValue(null);
    loadThemeSettings.mockResolvedValue({});
  });

  it('loadStorefrontPageContext resolves theme, locale, and currency', async () => {
    const request = new Request('http://localhost/');
    const context = await loadStorefrontPageContext(request);

    expect(context).toEqual({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
      themeSettings: {},
    });
    expect(preloadStorefrontTheme).toHaveBeenCalledOnce();
    expect(getRequestLocale).toHaveBeenCalledWith(request);
    expect(getRequestCurrency).toHaveBeenCalledWith(request);
  });

  it('includes themeSettings from the active theme manifest', async () => {
    const manifest = {
      id: '@bermooda/theme-default',
      settings: [{ key: 'accentColor', type: 'text' }],
    };
    preloadStorefrontTheme.mockResolvedValue('@bermooda/theme-default');
    getRegisteredTheme.mockReturnValue(manifest);
    loadThemeSettings.mockResolvedValue({ accentColor: '#111' });

    const ctx = await loadStorefrontPageContext(
      new Request('http://localhost/')
    );

    expect(getRegisteredTheme).toHaveBeenCalledWith('@bermooda/theme-default');
    expect(loadThemeSettings).toHaveBeenCalledWith(manifest);
    expect(ctx.themeSettings).toEqual({ accentColor: '#111' });
  });

  it('parseReturnTo accepts same-origin paths', () => {
    const formData = new FormData();
    formData.set('returnTo', '/products/shirt');
    expect(parseReturnTo(formData)).toBe('/products/shirt');
  });

  it('parseReturnTo rejects external URLs', () => {
    const formData = new FormData();
    formData.set('returnTo', 'https://evil.example/phish');
    expect(parseReturnTo(formData)).toBe('/');
  });
});
