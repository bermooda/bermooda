import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/currency/index.server', () => ({
  getRequestCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('#/core/i18n/index.server', () => ({
  getRequestLocale: vi.fn().mockResolvedValue('en'),
}));

vi.mock('#/core/themes/index.server', () => ({
  preloadStorefrontTheme: vi.fn().mockResolvedValue('default'),
}));

import {
  loadStorefrontPageContext,
  parseReturnTo,
} from '#/core/storefront/page-context.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';

describe('storefront page context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadStorefrontPageContext resolves theme, locale, and currency', async () => {
    const request = new Request('http://localhost/');
    const context = await loadStorefrontPageContext(request);

    expect(context).toEqual({
      themeId: 'default',
      locale: 'en',
      currency: 'USD',
    });
    expect(preloadStorefrontTheme).toHaveBeenCalledOnce();
    expect(getRequestLocale).toHaveBeenCalledWith(request);
    expect(getRequestCurrency).toHaveBeenCalledWith(request);
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
