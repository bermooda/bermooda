// app/core/gdpr/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = {
  customerSession: { deleteMany: vi.fn() },
  customerAccount: { deleteMany: vi.fn() },
  customerTwoFactor: { deleteMany: vi.fn() },
  address: { deleteMany: vi.fn() },
  cart: { updateMany: vi.fn() },
  order: { update: vi.fn() },
  customer: { update: vi.fn() },
};

vi.mock('#/libs/prisma.server', () => ({
  default: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => fn(mockTx)),
  },
}));

import prisma from '#/libs/prisma.server';
import {
  parseConsent,
  parseConsentCookie,
  buildConsentCookieValue,
  exportCustomerData,
  eraseCustomer,
  updateCustomerConsent,
} from '#/core/gdpr/index.server';

describe('gdpr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseConsent returns defaults when empty', () => {
    expect(parseConsent(null)).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
      updatedAt: null,
    });
  });

  it('parseConsentCookie decodes cookie JSON', () => {
    const value = buildConsentCookieValue({
      analytics: true,
      marketing: false,
    });
    const parsed = parseConsentCookie(value);
    expect(parsed.analytics).toBe(true);
    expect(parsed.marketing).toBe(false);
    expect(parsed.updatedAt).toBeTruthy();
  });

  it('exportCustomerData bundles customer records', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      email: 'user@test.com',
      name: 'User',
      phone: null,
      preferredLocale: 'en',
      emailVerified: true,
      consentJson: '{"analytics":true}',
      createdAt: new Date('2026-01-01'),
      erasedAt: null,
      addresses: [],
      orders: [],
      carts: [],
      sessions: [],
    });

    const data = await exportCustomerData('c1');

    expect(data.customer.email).toBe('user@test.com');
    expect(data.customer.consent.analytics).toBe(true);
    expect(data.exportedAt).toBeTruthy();
  });

  it('eraseCustomer anonymizes PII and preserves orders', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cust-abc12345',
      erasedAt: null,
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        shippingAddressJson: JSON.stringify({
          firstName: 'Jane',
          line1: '123 Main',
          country: 'US',
        }),
        billingAddressJson: null,
      },
    ]);

    const result = await eraseCustomer('cust-abc12345');

    expect(result.anonymizedEmail).toContain('@anonymized.invalid');
    expect(mockTx.customerSession.deleteMany).toHaveBeenCalled();
    expect(mockTx.address.deleteMany).toHaveBeenCalled();
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({
        email: result.anonymizedEmail,
        shippingAddressJson: expect.stringContaining('Anonymized'),
      }),
    });
    expect(mockTx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-abc12345' },
      data: expect.objectContaining({
        email: result.anonymizedEmail,
        name: null,
        erasedAt: expect.any(Date),
      }),
    });
  });

  it('updateCustomerConsent merges preferences', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      consentJson: '{"analytics":false,"marketing":false}',
    });
    prisma.customer.update.mockResolvedValue({});

    const next = await updateCustomerConsent('c1', { analytics: true });

    expect(next.analytics).toBe(true);
    expect(prisma.customer.update).toHaveBeenCalled();
  });
});
