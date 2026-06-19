// app/core/gdpr/index.server.js
// GDPR data export, erasure, and consent/cookie management hooks.

import prisma from '#/libs/prisma.server';

const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.invalid';
const DEFAULT_CONSENT = {
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: null,
};

/**
 * Parse a consent JSON blob from the customer record.
 * @param {string|null|undefined} consentJson
 */
export function parseConsent(consentJson) {
  if (!consentJson) return { ...DEFAULT_CONSENT };
  try {
    const parsed = JSON.parse(consentJson);
    return { ...DEFAULT_CONSENT, ...parsed };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

/**
 * Parse the storefront consent cookie value.
 * Hook for themes/plugins — returns normalized consent flags.
 *
 * @param {string|null|undefined} cookieValue
 */
export function parseConsentCookie(cookieValue) {
  if (!cookieValue) return { ...DEFAULT_CONSENT };
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue));
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

/**
 * Build a Set-Cookie value for consent preferences.
 *
 * @param {{ analytics?: boolean, marketing?: boolean }} consents
 * @returns {string}
 */
export function buildConsentCookieValue(consents) {
  return encodeURIComponent(
    JSON.stringify({
      analytics: Boolean(consents.analytics),
      marketing: Boolean(consents.marketing),
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Export all personal data for a customer as a portable JSON bundle.
 *
 * @param {string} customerId
 */
export async function exportCustomerData(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: true,
      orders: {
        include: {
          lines: true,
          refunds: true,
          discounts: true,
        },
      },
      carts: {
        include: { lines: true },
      },
      sessions: {
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'NOT_FOUND' });
  }

  return {
    exportedAt: new Date().toISOString(),
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      preferredLocale: customer.preferredLocale,
      emailVerified: customer.emailVerified,
      consent: parseConsent(customer.consentJson),
      createdAt: customer.createdAt.toISOString(),
      erasedAt: customer.erasedAt?.toISOString() ?? null,
    },
    addresses: customer.addresses,
    orders: customer.orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })),
    carts: customer.carts,
    activeSessions: customer.sessions.length,
  };
}

/**
 * Update stored consent preferences for a customer.
 *
 * @param {string} customerId
 * @param {{ analytics?: boolean, marketing?: boolean }} consents
 */
export async function updateCustomerConsent(customerId, consents) {
  const current = parseConsent(
    (
      await prisma.customer.findUnique({
        where: { id: customerId },
        select: { consentJson: true },
      })
    )?.consentJson
  );

  const next = {
    ...current,
    analytics:
      consents.analytics !== undefined
        ? Boolean(consents.analytics)
        : current.analytics,
    marketing:
      consents.marketing !== undefined
        ? Boolean(consents.marketing)
        : current.marketing,
    updatedAt: new Date().toISOString(),
  };

  await prisma.customer.update({
    where: { id: customerId },
    data: { consentJson: JSON.stringify(next) },
  });

  return next;
}

/**
 * Strip PII from a JSON address blob while preserving structure.
 * @param {string|null} json
 */
function anonymizeAddressJson(json) {
  if (!json) return json;
  try {
    const addr = JSON.parse(json);
    return JSON.stringify({
      ...addr,
      firstName: 'Anonymized',
      lastName: 'Customer',
      company: null,
      line1: 'Redacted',
      line2: null,
      city: addr.city ? 'Redacted' : null,
      state: null,
      postalCode: null,
      country: addr.country ?? 'XX',
      phone: null,
      email: null,
    });
  } catch {
    return json;
  }
}

/**
 * Erase a customer's personal data while preserving order integrity.
 *
 * @param {string} customerId
 */
export async function eraseCustomer(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, erasedAt: true },
  });

  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'NOT_FOUND' });
  }
  if (customer.erasedAt) {
    throw Object.assign(new Error('Customer already erased'), {
      code: 'ALREADY_ERASED',
    });
  }

  const anonymizedEmail = `erased-${customerId.slice(0, 8)}@${ANONYMIZED_EMAIL_DOMAIN}`;

  const orders = await prisma.order.findMany({
    where: { customerId },
    select: {
      id: true,
      shippingAddressJson: true,
      billingAddressJson: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.customerSession.deleteMany({ where: { customerId } });
    await tx.customerAccount.deleteMany({ where: { customerId } });
    await tx.customerTwoFactor.deleteMany({ where: { customerId } });
    await tx.address.deleteMany({ where: { customerId } });
    await tx.cart.updateMany({
      where: { customerId },
      data: { customerId: null },
    });

    for (const order of orders) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          email: anonymizedEmail,
          shippingAddressJson: anonymizeAddressJson(order.shippingAddressJson),
          billingAddressJson: anonymizeAddressJson(order.billingAddressJson),
        },
      });
    }

    await tx.customer.update({
      where: { id: customerId },
      data: {
        email: anonymizedEmail,
        name: null,
        phone: null,
        preferredLocale: null,
        consentJson: null,
        emailVerified: false,
        erasedAt: new Date(),
      },
    });
  });

  return { customerId, anonymizedEmail };
}
