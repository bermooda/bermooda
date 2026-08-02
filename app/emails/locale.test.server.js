// app/emails/locale.test.server.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
  SETTING_KEYS: { DEFAULT_LOCALE: 'defaultLocale' },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    customer: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { resolveAuthEmailLocale } from '#/emails/locale.server';

describe('resolveAuthEmailLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsGet.mockResolvedValue('en');
    prisma.customer.findUnique.mockResolvedValue(null);
  });

  it('uses validated settings defaultLocale when no customer preference', async () => {
    settingsGet.mockResolvedValue('de');
    await expect(resolveAuthEmailLocale({ email: 'a@b.com' })).resolves.toBe(
      'de'
    );
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to en when settings locale is invalid', async () => {
    settingsGet.mockResolvedValue('!!!');
    await expect(resolveAuthEmailLocale()).resolves.toBe('en');
  });

  it('falls back to en when settings locale is missing', async () => {
    settingsGet.mockResolvedValue(null);
    await expect(resolveAuthEmailLocale()).resolves.toBe('en');
  });

  it('prefers customer.preferredLocale when requested and valid', async () => {
    settingsGet.mockResolvedValue('en');
    prisma.customer.findUnique.mockResolvedValue({ preferredLocale: 'fr' });

    await expect(
      resolveAuthEmailLocale({
        email: 'cust@example.com',
        preferCustomerLocale: true,
      })
    ).resolves.toBe('fr');

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { email: 'cust@example.com' },
      select: { preferredLocale: true },
    });
  });

  it('ignores invalid customer preferredLocale and uses settings', async () => {
    settingsGet.mockResolvedValue('de');
    prisma.customer.findUnique.mockResolvedValue({
      preferredLocale: 'not-a-locale!!',
    });

    await expect(
      resolveAuthEmailLocale({
        email: 'cust@example.com',
        preferCustomerLocale: true,
      })
    ).resolves.toBe('de');
  });

  it('does not look up customer when preferCustomerLocale is false', async () => {
    settingsGet.mockResolvedValue('de');
    await expect(
      resolveAuthEmailLocale({
        email: 'admin@example.com',
        preferCustomerLocale: false,
      })
    ).resolves.toBe('de');
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });
});
