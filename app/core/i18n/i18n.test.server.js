// app/core/i18n/i18n.test.server.js
// Server-environment tests for the i18n resolver.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use the mocked modules.
// ---------------------------------------------------------------------------

vi.mock('#/utils/cache.server', () => ({
  getCachedResult: vi.fn(async (_k, cb) => cb()),
  default: { delete: vi.fn() },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
}));

// We mock the 'fs' module to avoid real filesystem reads in loadMessages tests.
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

import { readFileSync } from 'fs';

import {
  getRequestLocale,
  loadMessages,
  resolveLocale,
  setLocaleCookie,
  t,
} from '#/core/i18n/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest({ cookie = '', acceptLanguage = '' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return { headers };
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: settings return null (no theme, no plugins, no defaultLocale).
  settingsGet.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// 1. getRequestLocale — locale cookie
// ---------------------------------------------------------------------------

describe('getRequestLocale', () => {
  it('returns locale from locale cookie when present', async () => {
    const request = makeRequest({ cookie: 'session=abc; locale=de; foo=bar' });
    const locale = await getRequestLocale(request);
    expect(locale).toBe('de');
  });

  it('falls back to Accept-Language when no cookie is set', async () => {
    const request = makeRequest({ acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' });
    const locale = await getRequestLocale(request);
    expect(locale).toBe('fr');
  });

  it('falls back to defaultLocale setting when no cookie and no Accept-Language', async () => {
    settingsGet.mockResolvedValue('es');
    const request = makeRequest();
    const locale = await getRequestLocale(request);
    expect(locale).toBe('es');
  });

  it('returns "en" when no cookie, no Accept-Language, and no defaultLocale setting', async () => {
    settingsGet.mockResolvedValue(null);
    const request = makeRequest();
    const locale = await getRequestLocale(request);
    expect(locale).toBe('en');
  });

  it('normalises Accept-Language tag to primary subtag only', async () => {
    const request = makeRequest({ acceptLanguage: 'zh-TW,zh;q=0.9' });
    const locale = await getRequestLocale(request);
    expect(locale).toBe('zh');
  });

  it('prefers cookie over Accept-Language', async () => {
    const request = makeRequest({
      cookie: 'locale=ja',
      acceptLanguage: 'en-US',
    });
    const locale = await getRequestLocale(request);
    expect(locale).toBe('ja');
  });
});

// ---------------------------------------------------------------------------
// 4. loadMessages — merge from core + theme + plugin files
// ---------------------------------------------------------------------------

describe('loadMessages', () => {
  it('returns merged messages from core + theme + plugin files', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'activeTheme') return 'my-theme';
      if (key === 'pluginOrder') return ['my-plugin'];
      return null;
    });

    readFileSync
      // core messages
      .mockReturnValueOnce(JSON.stringify({ common: { save: 'Save' } }))
      // theme overrides
      .mockReturnValueOnce(
        JSON.stringify({ common: { save: 'Speichern', cancel: 'Abbrechen' } })
      )
      // plugin additions
      .mockReturnValueOnce(JSON.stringify({ plugin: { hello: 'Hello' } }));

    const messages = await loadMessages('en');

    // Theme overrides core for 'common.save'.
    expect(messages.common.save).toBe('Speichern');
    // Theme adds 'common.cancel'.
    expect(messages.common.cancel).toBe('Abbrechen');
    // Plugin adds its own namespace.
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

    // All three files are missing — should return an empty object, not throw.
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
    // readFileSync called exactly once (only core file).
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 6. t — dot-notation key resolution
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// setLocaleCookie
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// resolveLocale
// ---------------------------------------------------------------------------

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
    const response = new Response();
    const locale = await resolveLocale(request, response);
    expect(locale).toBe('ja');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
