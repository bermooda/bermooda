// app/core/i18n/index.test.server.js
// Server-environment tests for the i18n resolver.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/cache/index.server', () => ({
  getCachedResult: vi.fn(async (_k, cb) => cb()),
  default: { delete: vi.fn() },
}));

vi.mock('#/core/settings/index.server', async () => {
  const { normalizeLocaleList } = await import('#/core/i18n/locales');
  const get = vi.fn();
  return {
    get,
    getEnabledLocales: vi.fn(async () =>
      normalizeLocaleList(await get('locales'))
    ),
  };
});

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('#/libs/auth/customer/index.server', () => ({
  getCustomerSession: vi.fn(),
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    customer: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('#/core/themes/index.server', () => ({
  getRegisteredTheme: vi.fn(),
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPlugin: vi.fn(),
}));

import { readFileSync } from 'fs';

import logger from '#/utils/logger.server';
import { getCustomerSession } from '#/libs/auth/customer/index.server';
import prisma from '#/libs/prisma.server';
import {
  appendLocaleCookie,
  getAdminRequestLocale,
  getRequestLocale,
  loadMessages,
  loadStorefrontMessages,
  resolveLocale,
} from '#/core/i18n/index.server';
import { getRegisteredPlugin } from '#/core/plugins/index.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { getRegisteredTheme } from '#/core/themes/index.server';

function makeRequest({ cookie = '', acceptLanguage = '' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return { headers };
}

function mockLocaleSettings({
  defaultLocale = 'en',
  locales = ['en', 'de', 'fr'],
} = {}) {
  settingsGet.mockImplementation(async (key) => {
    if (key === 'defaultLocale') return defaultLocale;
    if (key === 'locales') return locales;
    if (key === 'activeTheme') return null;
    if (key === 'pluginOrder') return [];
    if (key === 'enabledPlugins') return [];
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue(null);
  prisma.customer.findUnique.mockResolvedValue(null);
  getRegisteredTheme.mockReturnValue(null);
  getRegisteredPlugin.mockReturnValue(null);
  mockLocaleSettings();
});

describe('getRequestLocale', () => {
  it('returns locale from locale cookie when present and enabled', async () => {
    const request = makeRequest({ cookie: 'session=abc; locale=de; foo=bar' });
    await expect(getRequestLocale(request)).resolves.toBe('de');
  });

  it('ignores cookie locale when it is not enabled', async () => {
    mockLocaleSettings({ locales: ['en'] });
    const request = makeRequest({
      cookie: 'locale=de',
      acceptLanguage: 'en-US',
    });
    await expect(getRequestLocale(request)).resolves.toBe('en');
  });

  it('falls back to Accept-Language when no cookie is set', async () => {
    const request = makeRequest({ acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' });
    await expect(getRequestLocale(request)).resolves.toBe('fr');
  });

  it('falls back to defaultLocale setting when no cookie and no Accept-Language', async () => {
    mockLocaleSettings({ defaultLocale: 'es', locales: ['en', 'es'] });
    const request = makeRequest();
    await expect(getRequestLocale(request)).resolves.toBe('es');
  });

  it('returns enabled default when defaultLocale setting is disabled', async () => {
    mockLocaleSettings({ defaultLocale: 'ja', locales: ['en', 'de'] });
    const request = makeRequest();
    await expect(getRequestLocale(request)).resolves.toBe('en');
  });

  it('returns "en" when no cookie, no Accept-Language, and no defaultLocale setting', async () => {
    mockLocaleSettings({ defaultLocale: null, locales: ['en'] });
    const request = makeRequest();
    await expect(getRequestLocale(request)).resolves.toBe('en');
  });

  it('normalises Accept-Language tag to primary subtag only', async () => {
    mockLocaleSettings({ locales: ['en', 'zh'] });
    const request = makeRequest({ acceptLanguage: 'zh-TW,zh;q=0.9' });
    await expect(getRequestLocale(request)).resolves.toBe('zh');
  });

  it('prefers cookie over Accept-Language', async () => {
    const request = makeRequest({
      cookie: 'locale=ja',
      acceptLanguage: 'en-US',
    });
    mockLocaleSettings({ locales: ['en', 'ja'] });
    await expect(getRequestLocale(request)).resolves.toBe('ja');
  });

  it('uses customer preferredLocale when logged in and no cookie', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    prisma.customer.findUnique.mockResolvedValue({ preferredLocale: 'fr' });
    const request = makeRequest();
    await expect(getRequestLocale(request)).resolves.toBe('fr');
  });

  it('negotiates past an unsupported first Accept-Language range', async () => {
    mockLocaleSettings({ locales: ['en', 'fr'] });
    const request = makeRequest({ acceptLanguage: 'es-ES,es;q=0.9,fr;q=0.8' });
    await expect(getRequestLocale(request)).resolves.toBe('fr');
  });

  it('honors Accept-Language q-values over header order', async () => {
    const request = makeRequest({ acceptLanguage: 'en;q=0.2,de;q=0.9' });
    await expect(getRequestLocale(request)).resolves.toBe('de');
  });

  it('prefers cookie over customer preferredLocale', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    prisma.customer.findUnique.mockResolvedValue({ preferredLocale: 'fr' });
    const request = makeRequest({ cookie: 'locale=de' });
    await expect(getRequestLocale(request)).resolves.toBe('de');
  });
});

describe('getAdminRequestLocale', () => {
  it('honors an admin locale cookie the storefront does not enable', async () => {
    mockLocaleSettings({ locales: ['en'] });
    const request = makeRequest({ cookie: 'locale=de' });
    await expect(getAdminRequestLocale(request)).resolves.toBe('de');
  });

  it('ignores cookie locales without an admin catalog', async () => {
    mockLocaleSettings({ locales: ['en', 'ja'] });
    const request = makeRequest({ cookie: 'locale=ja', acceptLanguage: 'fr' });
    await expect(getAdminRequestLocale(request)).resolves.toBe('fr');
  });

  it('never looks up the customer session', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    prisma.customer.findUnique.mockResolvedValue({ preferredLocale: 'fr' });
    await expect(getAdminRequestLocale(makeRequest())).resolves.toBe('en');
    expect(getCustomerSession).not.toHaveBeenCalled();
  });

  it('falls back to the defaultLocale setting when it is an admin locale', async () => {
    mockLocaleSettings({ defaultLocale: 'fr', locales: ['fr'] });
    await expect(getAdminRequestLocale(makeRequest())).resolves.toBe('fr');
  });

  it('falls back to en when defaultLocale has no admin catalog', async () => {
    mockLocaleSettings({ defaultLocale: 'ja', locales: ['ja'] });
    await expect(getAdminRequestLocale(makeRequest())).resolves.toBe('en');
  });
});

describe('loadMessages', () => {
  it('returns bundled core messages merged with theme + plugin files', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return '@acme/my-theme';
      if (key === 'pluginOrder') return ['@acme/my-plugin'];
      if (key === 'enabledPlugins') return ['@acme/my-plugin'];
      return null;
    });
    getRegisteredTheme.mockImplementation((id) =>
      id === '@acme/my-theme' ? { slug: 'my-theme' } : null
    );
    getRegisteredPlugin.mockImplementation((id) =>
      id === '@acme/my-plugin' ? { slug: 'my-plugin' } : null
    );

    readFileSync
      .mockReturnValueOnce(
        JSON.stringify({
          'common.save': 'Speichern',
          'common.cancel': 'Abbrechen',
        })
      )
      .mockReturnValueOnce(JSON.stringify({ plugin: { hello: 'Hello' } }));

    const messages = await loadMessages('en');

    expect(messages['common.save']).toBe('Speichern');
    expect(messages['common.cancel']).toBe('Abbrechen');
    expect(messages.plugin.hello).toBe('Hello');
    expect(messages['admin.dashboard.title']).toBe('Dashboard');
    expect(readFileSync).toHaveBeenCalledTimes(2);
  });

  it('skips disabled plugins even when present in pluginOrder', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return ['@acme/disabled-plugin'];
      if (key === 'enabledPlugins') return [];
      return null;
    });
    getRegisteredPlugin.mockImplementation((id) =>
      id === '@acme/disabled-plugin' ? { slug: 'disabled-plugin' } : null
    );

    const messages = await loadMessages('en');
    expect(messages['common.loading']).toBe('Loading...');
    expect(readFileSync).toHaveBeenCalledTimes(0);
    expect(
      readFileSync.mock.calls.some(([p]) =>
        String(p).includes('/plugins/disabled-plugin/')
      )
    ).toBe(false);
  });

  it('keeps bundled core messages when theme/plugin files are missing', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return '@acme/missing-theme';
      if (key === 'pluginOrder') return ['@acme/missing-plugin'];
      if (key === 'enabledPlugins') return ['@acme/missing-plugin'];
      return null;
    });
    getRegisteredTheme.mockImplementation((id) =>
      id === '@acme/missing-theme' ? { slug: 'missing-theme' } : null
    );
    getRegisteredPlugin.mockImplementation((id) =>
      id === '@acme/missing-plugin' ? { slug: 'missing-plugin' } : null
    );

    const enoent = new Error('ENOENT: no such file');
    enoent.code = 'ENOENT';
    readFileSync.mockImplementation(() => {
      throw enoent;
    });

    const messages = await loadMessages('en');
    expect(messages['admin.dashboard.title']).toBe('Dashboard');
    expect(messages['common.loading']).toBe('Loading...');
  });

  it('returns only bundled core messages when no theme or plugins are configured', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      if (key === 'enabledPlugins') return [];
      return null;
    });

    const messages = await loadMessages('en');
    expect(messages['common.loading']).toBe('Loading...');
    expect(messages['admin.nav.dashboard']).toBe('Dashboard');
    expect(readFileSync).toHaveBeenCalledTimes(0);
  });

  it('resolves package ids to registered theme/plugin slug paths under cwd/app', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return '@bermooda/theme-default';
      if (key === 'pluginOrder') return ['@bermooda/plugin-meilisearch'];
      if (key === 'enabledPlugins') return ['@bermooda/plugin-meilisearch'];
      return null;
    });
    getRegisteredTheme.mockImplementation((id) =>
      id === '@bermooda/theme-default' ? { slug: 'default' } : null
    );
    getRegisteredPlugin.mockImplementation((id) =>
      id === '@bermooda/plugin-meilisearch' ? { slug: 'meilisearch' } : null
    );

    const enoent = new Error('ENOENT: no such file');
    enoent.code = 'ENOENT';
    readFileSync.mockImplementation(() => {
      throw enoent;
    });

    await loadMessages('en');

    const paths = readFileSync.mock.calls.map(([filePath]) => String(filePath));
    expect(
      paths.some(
        (p) =>
          p.endsWith('/app/themes/default/i18n/en.json') ||
          p.includes(`${process.cwd()}/app/themes/default/i18n/`)
      )
    ).toBe(true);
    expect(
      paths.some((p) =>
        p.includes(`${process.cwd()}/app/plugins/meilisearch/i18n/`)
      )
    ).toBe(true);
    expect(paths.every((p) => !p.includes('/core/i18n/messages/'))).toBe(true);
  });

  it('skips theme/plugin i18n when ids are not registered', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return '@bermooda/theme-default';
      if (key === 'pluginOrder') return ['@bermooda/plugin-meilisearch'];
      if (key === 'enabledPlugins') return ['@bermooda/plugin-meilisearch'];
      return null;
    });

    const messages = await loadMessages('en');
    expect(messages['common.loading']).toBe('Loading...');
    expect(readFileSync).toHaveBeenCalledTimes(0);
  });

  it('keeps English values for keys missing from a partial locale overlay', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      if (key === 'enabledPlugins') return [];
      return null;
    });

    const messages = await loadMessages('de');
    expect(messages['common.save']).toBe('Speichern');
    expect(messages['common.cancel']).toBe('Abbrechen');
    expect(messages['admin.dashboard.title']).toBe('Dashboard');
  });

  it('lets the requested locale override shared English keys', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      if (key === 'enabledPlugins') return [];
      return null;
    });

    const messages = await loadMessages('fr');
    expect(messages['common.save']).toBe('Enregistrer');
    expect(messages['admin.dashboard.title']).toBe('Tableau de bord');
  });

  it('returns the English catalog when an unknown locale has no core overlay', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      if (key === 'enabledPlugins') return [];
      return null;
    });

    const messages = await loadMessages('ja');
    expect(messages['common.loading']).toBe('Loading...');
    expect(messages['admin.dashboard.title']).toBe('Dashboard');
  });

  it('does not read core catalogs from disk when locale is en', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      if (key === 'enabledPlugins') return [];
      return null;
    });

    const messages = await loadMessages('en');
    expect(messages['common.loading']).toBe('Loading...');
    expect(readFileSync).toHaveBeenCalledTimes(0);
  });

  it('loads en base then locale overlay for theme and plugin catalogs', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return '@acme/my-theme';
      if (key === 'pluginOrder') return ['@acme/my-plugin'];
      if (key === 'enabledPlugins') return ['@acme/my-plugin'];
      return null;
    });
    getRegisteredTheme.mockImplementation((id) =>
      id === '@acme/my-theme' ? { slug: 'my-theme' } : null
    );
    getRegisteredPlugin.mockImplementation((id) =>
      id === '@acme/my-plugin' ? { slug: 'my-plugin' } : null
    );

    readFileSync.mockImplementation((filePath) => {
      const path = String(filePath);
      if (path.includes('/themes/my-theme/i18n/en.json')) {
        return JSON.stringify({ theme: { title: 'Theme EN' } });
      }
      if (path.includes('/plugins/my-plugin/i18n/en.json')) {
        return JSON.stringify({ plugin: { hello: 'Hello' } });
      }
      if (path.includes('/themes/my-theme/i18n/de.json')) {
        return JSON.stringify({ theme: { title: 'Theme DE' } });
      }
      const enoent = new Error('ENOENT: no such file');
      enoent.code = 'ENOENT';
      throw enoent;
    });

    const messages = await loadMessages('de');
    expect(messages['common.save']).toBe('Speichern');
    expect(messages['common.cancel']).toBe('Abbrechen');
    expect(messages.theme.title).toBe('Theme DE');
    expect(messages.plugin.hello).toBe('Hello');

    const paths = readFileSync.mock.calls.map(([filePath]) => String(filePath));
    expect(paths.filter((p) => p.endsWith('/en.json'))).toHaveLength(2);
    expect(paths.filter((p) => p.endsWith('/de.json'))).toHaveLength(2);
    expect(paths.every((p) => !p.includes('/core/i18n/messages/'))).toBe(true);
  });
});

describe('appendLocaleCookie', () => {
  it('appends a Set-Cookie header', () => {
    const headers = new Headers();
    appendLocaleCookie(headers, 'fr');
    expect(headers.get('set-cookie')).toBe(
      'locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    );
  });

  it('does not set a cookie for invalid locale values', () => {
    const headers = new Headers();
    appendLocaleCookie(headers, 'bad;locale');
    expect(headers.get('set-cookie')).toBeNull();
  });

  it('does not set a cookie for locale with injection characters', () => {
    const headers = new Headers();
    appendLocaleCookie(headers, 'en; Path=/evil');
    expect(headers.get('set-cookie')).toBeNull();
  });
});

describe('resolveLocale', () => {
  it('sets the cookie when no locale cookie is present and returns the locale', async () => {
    const request = makeRequest({ acceptLanguage: 'de-DE,de;q=0.9' });
    const headers = new Headers();
    const locale = await resolveLocale(request, headers);
    expect(locale).toBe('de');
    expect(headers.get('set-cookie')).toBe(
      'locale=de; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    );
  });

  it('does not set the cookie when a locale cookie is already present', async () => {
    const request = makeRequest({
      cookie: 'locale=ja',
      acceptLanguage: 'en-US',
    });
    mockLocaleSettings({ locales: ['en', 'ja'] });
    const headers = new Headers();
    const locale = await resolveLocale(request, headers);
    expect(locale).toBe('ja');
    expect(headers.get('set-cookie')).toBeNull();
  });
});

describe('loadMessages catalog safety', () => {
  function mockThemeCatalog(contents) {
    settingsGet.mockImplementation(async (key) =>
      key === 'activeTheme' ? '@acme/my-theme' : null
    );
    getRegisteredTheme.mockReturnValue({ slug: 'my-theme' });
    readFileSync.mockReturnValue(contents);
  }

  it('logs and skips a theme catalog with invalid JSON', async () => {
    mockThemeCatalog('{ not json');
    const messages = await loadMessages('en');
    expect(messages['common.save']).toBe('Save');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: expect.stringContaining('my-theme'),
      }),
      'Skipping unreadable i18n catalog'
    );
  });

  it('logs and skips a theme catalog that is not an object', async () => {
    mockThemeCatalog('["a", "b"]');
    const messages = await loadMessages('en');
    expect(messages['0']).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Skipping i18n catalog that is not an object'
    );
  });

  it('ignores __proto__ / constructor keys in extension catalogs', async () => {
    mockThemeCatalog(
      '{"__proto__": {"polluted": "yes"}, "constructor": {"x": 1}, "nav.home": "Home"}'
    );
    const messages = await loadMessages('en');
    expect(messages['nav.home']).toBe('Home');
    expect(Object.getPrototypeOf(messages)).toBe(Object.prototype);
    expect(messages.polluted).toBeUndefined();
    expect(Object.hasOwn(messages, 'constructor')).toBe(false);
  });
});

describe('loadStorefrontMessages', () => {
  it('drops flat and nested admin keys, keeping common + extension keys', async () => {
    settingsGet.mockImplementation(async (key) =>
      key === 'activeTheme' ? '@acme/my-theme' : null
    );
    getRegisteredTheme.mockReturnValue({ slug: 'my-theme' });
    readFileSync.mockReturnValue(
      JSON.stringify({
        'cart.title': 'Shopping Cart',
        'admin': { themeSettings: 'Theme settings' },
        'administrator.note': 'kept',
      })
    );

    const messages = await loadStorefrontMessages('en');

    expect(messages['common.save']).toBe('Save');
    expect(messages['cart.title']).toBe('Shopping Cart');
    expect(messages['administrator.note']).toBe('kept');
    expect(messages.admin).toBeUndefined();
    expect(Object.keys(messages).some((key) => key.startsWith('admin.'))).toBe(
      false
    );
  });
});
