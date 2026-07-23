// app/core/i18n/index.test.server.js
// Server-environment tests for the i18n resolver.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/cache/index.server', () => ({
  getCachedResult: vi.fn(async (_k, cb) => cb()),
  default: { delete: vi.fn() },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
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

import { readFileSync } from 'fs';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import prisma from '#/libs/prisma.server';
import {
  getAvailableLocales,
  getRequestLocale,
  loadMessages,
  resolveLocale,
  setLocaleCookie,
  t,
} from '#/core/i18n/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

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
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue(null);
  prisma.customer.findUnique.mockResolvedValue(null);
  mockLocaleSettings();
});

describe('getAvailableLocales', () => {
  it('returns enabled locales from settings', async () => {
    settingsGet.mockImplementation(async (key) =>
      key === 'locales' ? ['en', 'ja'] : null
    );
    await expect(getAvailableLocales()).resolves.toEqual(['en', 'ja']);
  });

  it('falls back when settings locales are empty', async () => {
    settingsGet.mockImplementation(async (key) =>
      key === 'locales' ? [] : null
    );
    await expect(getAvailableLocales()).resolves.toEqual(['en', 'de', 'fr']);
  });
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

  it('prefers cookie over customer preferredLocale', async () => {
    getCustomerSession.mockResolvedValue({ user: { id: 'cust_1' } });
    prisma.customer.findUnique.mockResolvedValue({ preferredLocale: 'fr' });
    const request = makeRequest({ cookie: 'locale=de' });
    await expect(getRequestLocale(request)).resolves.toBe('de');
  });
});

describe('loadMessages', () => {
  it('returns merged messages from core + theme + plugin files', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return 'my-theme';
      if (key === 'pluginOrder') return ['my-plugin'];
      return null;
    });

    readFileSync
      .mockReturnValueOnce(JSON.stringify({ common: { save: 'Save' } }))
      .mockReturnValueOnce(
        JSON.stringify({ common: { save: 'Speichern', cancel: 'Abbrechen' } })
      )
      .mockReturnValueOnce(JSON.stringify({ plugin: { hello: 'Hello' } }));

    const messages = await loadMessages('en');

    expect(messages.common.save).toBe('Speichern');
    expect(messages.common.cancel).toBe('Abbrechen');
    expect(messages.plugin.hello).toBe('Hello');
  });

  it('skips files that do not exist (ENOENT) without throwing', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return 'missing-theme';
      if (key === 'pluginOrder') return ['missing-plugin'];
      return null;
    });

    const enoent = new Error('ENOENT: no such file');
    enoent.code = 'ENOENT';
    readFileSync.mockImplementation(() => {
      throw enoent;
    });

    await expect(loadMessages('en')).resolves.toEqual({});
  });

  it('returns only core messages when no theme or plugins are configured', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return null;
      if (key === 'pluginOrder') return [];
      return null;
    });

    readFileSync.mockReturnValueOnce(
      JSON.stringify({ common: { loading: 'Loading...' } })
    );

    const messages = await loadMessages('en');
    expect(messages.common.loading).toBe('Loading...');
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });
});

describe('t', () => {
  const messages = {
    'cart': { empty: 'Your cart is empty' },
    'flat.key': 'flat value',
  };

  it('resolves dot-notation keys', () => {
    expect(t('cart.empty', {}, messages)).toBe('Your cart is empty');
  });

  it('falls back to flat key lookup', () => {
    expect(t('flat.key', {}, messages)).toBe('flat value');
  });

  it('substitutes {param} placeholders', () => {
    const msgs = { greeting: 'Hello, {name}! You have {count} items.' };
    expect(t('greeting', { name: 'Alice', count: 3 }, msgs)).toBe(
      'Hello, Alice! You have 3 items.'
    );
  });

  it('returns the key when not found', () => {
    expect(t('missing.key', {}, messages)).toBe('missing.key');
  });

  it('leaves unreplaced placeholders intact when param is missing', () => {
    const msgs = { msg: 'Hello, {name}!' };
    expect(t('msg', {}, msgs)).toBe('Hello, {name}!');
  });
});

describe('setLocaleCookie', () => {
  it('appends a Set-Cookie header to the response', () => {
    const response = new Response();
    setLocaleCookie(response, 'fr');
    expect(response.headers.get('set-cookie')).toBe(
      'locale=fr; Path=/; SameSite=Lax; Max-Age=31536000'
    );
  });

  it('does not set a cookie for invalid locale values', () => {
    const response = new Response();
    setLocaleCookie(response, 'bad;locale');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not set a cookie for locale with injection characters', () => {
    const response = new Response();
    setLocaleCookie(response, 'en; Path=/evil');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('resolveLocale', () => {
  it('sets the cookie when no locale cookie is present and returns the locale', async () => {
    const request = makeRequest({ acceptLanguage: 'de-DE,de;q=0.9' });
    const response = new Response();
    const locale = await resolveLocale(request, response);
    expect(locale).toBe('de');
    expect(response.headers.get('set-cookie')).toBe(
      'locale=de; Path=/; SameSite=Lax; Max-Age=31536000'
    );
  });

  it('does not set the cookie when a locale cookie is already present', async () => {
    const request = makeRequest({
      cookie: 'locale=ja',
      acceptLanguage: 'en-US',
    });
    mockLocaleSettings({ locales: ['en', 'ja'] });
    const response = new Response();
    const locale = await resolveLocale(request, response);
    expect(locale).toBe('ja');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
