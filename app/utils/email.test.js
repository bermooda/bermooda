import { describe, expect, it } from 'vitest';

import { isValidEmail, normalizeEmail } from '#/utils/email';

describe('normalizeEmail', () => {
  it.each([
    [' Shop@Example.COM ', 'shop@example.com'],
    [null, ''],
    [undefined, ''],
    [42, '42'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});

describe('isValidEmail', () => {
  it.each([
    ['a@example.com', true],
    [' A@Example.com ', true],
    ['', false],
    ['a@example', false],
    ['a b@example.com', false],
    ['not-an-email', false],
    [null, false],
  ])('%j → %j', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});
