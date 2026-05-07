// app/core/i18n/index.test.jsx
import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { I18nContext } from './context';
import { translate, useT } from './index';

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

  it('prefers flat-dotted keys over nested traversal', () => {
    expect(
      translate(
        'nav.home',
        {},
        { 'nav.home': 'Home', 'nav': { home: 'WRONG' } }
      )
    ).toBe('Home');
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
