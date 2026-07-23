import { describe, expect, it } from 'vitest';

import { slugify } from '#/utils/slugify/index';

describe('slugify', () => {
  it('lowercases and hyphenates text', () => {
    expect(slugify('Bamboo Bluetooth Speaker')).toBe(
      'bamboo-bluetooth-speaker'
    );
  });

  it('strips accents and special characters', () => {
    expect(slugify('Café & Tea — Organic!')).toBe('cafe-tea-organic');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });
});
