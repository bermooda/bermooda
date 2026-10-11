import { describe, expect, it } from 'vitest';

import { getThemeFromRequest } from '#/utils/theme.server';

/** @param {string | undefined} cookie */
function req(cookie) {
  return new Request('http://shop.example/', {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

describe('getThemeFromRequest', () => {
  it.each([
    [undefined, null],
    ['theme=dark', 'dark'],
    ['a=1; theme=light; b=2', 'light'],
    ['theme="dark"', 'dark'],
    ['theme=blue', null],
    ['admin_theme=dark', null],
    ['theme=%E0%A4%A', null],
  ])('reads %j as %j', (cookie, expected) => {
    expect(getThemeFromRequest(req(cookie))).toBe(expected);
  });
});
