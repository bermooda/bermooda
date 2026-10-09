// app/core/i18n/index.test.jsx
import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  negotiateAcceptLanguage,
  translate,
  useI18nValue,
  useLocale,
  useT,
} from '#/core/i18n';
import { I18nContext } from '#/core/i18n/context';

// ---------------------------------------------------------------------------
// I18nContext
// ---------------------------------------------------------------------------

describe('I18nContext default value', () => {
  it('has a t function that returns the key as-is', () => {
    expect(I18nContext).toBeDefined();
    // Render useT without a provider — should fall back to identity
    const { result } = renderHook(() => useT());
    expect(result.current('some.key')).toBe('some.key');
  });
});

// ---------------------------------------------------------------------------
// translate — pure function
// ---------------------------------------------------------------------------

describe('translate', () => {
  it('returns the key when messages is empty', () => {
    expect(translate('greeting')).toBe('greeting');
  });

  it('returns the key when key is not found in messages', () => {
    expect(translate('missing', {}, { greeting: 'Hello' })).toBe('missing');
  });

  it('returns the message value without substitution when no params', () => {
    expect(translate('greeting', {}, { greeting: 'Hello there' })).toBe(
      'Hello there'
    );
  });

  it('substitutes {param} placeholders', () => {
    expect(
      translate('welcome', { name: 'Alice' }, { welcome: 'Hello {name}!' })
    ).toBe('Hello Alice!');
  });

  it('substitutes multiple different placeholders', () => {
    expect(
      translate(
        'msg',
        { count: 3, item: 'apples' },
        { msg: '{count} {item} remain' }
      )
    ).toBe('3 apples remain');
  });

  it('leaves unknown placeholder tokens as-is', () => {
    expect(
      translate('msg', { name: 'Bob' }, { msg: 'Hi {name}, your age is {age}' })
    ).toBe('Hi Bob, your age is {age}');
  });

  it('handles numeric param values', () => {
    expect(translate('count', { n: 42 }, { count: 'Total: {n}' })).toBe(
      'Total: 42'
    );
  });

  it('traverses nested objects via dot-notation', () => {
    expect(
      translate(
        'admin.topbar.switchLocale',
        {},
        { admin: { topbar: { switchLocale: 'Switch locale' } } }
      )
    ).toBe('Switch locale');
  });

  it('prefers nested keys over flat dotted keys', () => {
    expect(
      translate(
        'nav.home',
        {},
        { 'nav.home': 'Flat', 'nav': { home: 'Nested' } }
      )
    ).toBe('Nested');
  });

  it('falls back to a flat dotted key when nested traversal misses', () => {
    expect(translate('cart.empty', {}, { 'cart.empty': 'Empty' })).toBe(
      'Empty'
    );
  });

  it('returns the key when nested traversal lands on a non-string', () => {
    expect(translate('admin', {}, { admin: { topbar: 'x' } })).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// useT — React hook
// ---------------------------------------------------------------------------

describe('useT', () => {
  it('returns t function from I18nContext provider', () => {
    const customT = (key) => `translated:${key}`;
    const wrapper = ({ children }) =>
      React.createElement(
        I18nContext.Provider,
        { value: { t: customT } },
        children
      );

    const { result } = renderHook(() => useT(), { wrapper });

    expect(result.current('hello')).toBe('translated:hello');
  });
});

// ---------------------------------------------------------------------------
// useI18nValue / useLocale
// ---------------------------------------------------------------------------

describe('useI18nValue', () => {
  it('binds t to the catalog and keeps the value stable across renders', () => {
    const messages = { hi: 'Hallo {name}' };
    const { result, rerender } = renderHook(() => useI18nValue('de', messages));
    const first = result.current;

    expect(first.locale).toBe('de');
    expect(first.t('hi', { name: 'Ada' })).toBe('Hallo Ada');

    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useLocale', () => {
  it('falls back to the default locale without a provider', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// negotiateAcceptLanguage
// ---------------------------------------------------------------------------

describe('negotiateAcceptLanguage', () => {
  const supported = ['en', 'de', 'fr', 'pt-BR'];

  it.each([
    ['de-CH,de;q=0.9', 'de'],
    ['es-ES,es;q=0.9,fr;q=0.8', 'fr'],
    ['en;q=0.1, fr;q=0.7, de;q=0.7', 'fr'],
    ['pt-br', 'pt-BR'],
    ['pt_BR', 'pt-BR'],
    ['FR-ca', 'fr'],
  ])('%s → %s', (header, expected) => {
    expect(negotiateAcceptLanguage(header, supported)).toBe(expected);
  });

  it.each([
    ['', 'empty header'],
    ['*', 'wildcard only'],
    ['es, ja;q=0.5', 'no supported range'],
    ['de;q=0, es', 'q=0 excludes a range'],
    ['de;q=abc', 'malformed q-value'],
  ])('returns null for %j (%s)', (header) => {
    expect(negotiateAcceptLanguage(header, supported)).toBeNull();
  });

  it('returns null without supported locales', () => {
    expect(negotiateAcceptLanguage('de', [])).toBeNull();
  });
});
