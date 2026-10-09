import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/storefront/page-context.server', () => ({
  parseReturnTo: (formData, fallback = '/') => {
    const returnTo = formData.get('returnTo')?.toString();
    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
      return fallback;
    }
    return returnTo;
  },
}));

vi.mock('#/core/i18n/index.server', () => ({
  appendLocaleCookie: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  getEnabledLocales: vi.fn().mockResolvedValue(['en', 'es']),
}));

import { appendLocaleCookie } from '#/core/i18n/index.server';

import { action as setLocaleAction } from '#/routes/storefront/api/set-locale';

describe('storefront set-locale action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set-locale sets cookie for enabled locale', async () => {
    const form = new FormData();
    form.set('locale', 'es');
    form.set('returnTo', '/cart');

    const response = await setLocaleAction({
      request: new Request('http://localhost/api/set-locale', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/cart');
    expect(appendLocaleCookie).toHaveBeenCalledWith(response.headers, 'es');
  });

  it('set-locale ignores invalid locale but still redirects', async () => {
    const form = new FormData();
    form.set('locale', 'xx');
    form.set('returnTo', '/');

    const response = await setLocaleAction({
      request: new Request('http://localhost/api/set-locale', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(302);
    expect(appendLocaleCookie).not.toHaveBeenCalled();
  });

  it('set-locale accepts admin UI locales the storefront does not enable', async () => {
    const form = new FormData();
    form.set('locale', 'de');
    form.set('returnTo', '/admin/settings');

    const response = await setLocaleAction({
      request: new Request('http://localhost/api/set-locale', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.headers.get('Location')).toBe('/admin/settings');
    expect(appendLocaleCookie).toHaveBeenCalledWith(response.headers, 'de');
  });
});
