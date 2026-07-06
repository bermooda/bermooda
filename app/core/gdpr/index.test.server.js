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
  DEFAULT_CONSENT,
  parseConsent,
  parseConsentCookie,
  buildConsentCookieValue,
  hasMarketingConsent,
  parseUpdateConsentInput,
  parseUpdateConsentFormData,
  getCustomerConsentSummary,
  exportCustomerData,
  eraseCustomer,
  updateCustomerConsent,
} from '#/core/gdpr/index.server';

describe('gdpr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseConsent returns defaults when empty', () => {
    expect(parseConsent(null)).toEqual(DEFAULT_CONSENT);
  });

  it('hasMarketingConsent reads stored consent', () => {
    expect(hasMarketingConsent('{"marketing":true}')).toBe(true);
    expect(hasMarketingConsent(null)).toBe(false);
  });

  it('parseUpdateConsentInput only includes provided fields', () => {
    expect(parseUpdateConsentInput({ analytics: true })).toEqual({
      analytics: true,
    });
    expect(parseUpdateConsentInput({ marketing: 'true' })).toEqual({
      marketing: true,
    });
  });

  it('parseUpdateConsentFormData treats missing checkboxes as false', () => {
    const formData = new FormData();
    formData.set('analytics', 'on');

    expect(parseUpdateConsentFormData(formData)).toEqual({
      analytics: true,
      marketing: false,
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

  it('getCustomerConsentSummary returns parsed consent', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      consentJson: '{"analytics":true}',
      erasedAt: null,
    });

    const summary = await getCustomerConsentSummary('c1');

    expect(summary.customerId).toBe('c1');
    expect(summary.consent.analytics).toBe(true);
    expect(summary.erasedAt).toBeNull();
  });

  it('getCustomerConsentSummary throws when customer missing', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(getCustomerConsentSummary('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
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

  it('updateCustomerConsent throws when customer missing', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      updateCustomerConsent('missing', { analytics: true })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
