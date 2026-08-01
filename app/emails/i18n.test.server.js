// app/emails/i18n.test.server.js
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearEmailMessagesCache,
  emailT,
  loadEmailMessages,
} from '#/emails/i18n.server';

describe('email i18n catalogs', () => {
  beforeEach(() => {
    clearEmailMessagesCache();
  });

  it('loads flat English keys', () => {
    const messages = loadEmailMessages('en');
    expect(messages['orderConfirmation.heading']).toBe('Order Confirmed');
    expect(messages['abandonedCart.cta']).toBe('Complete Your Purchase');
  });

  it('overlays locale strings and falls back to en for missing keys', () => {
    const de = loadEmailMessages('de');
    expect(de['orderConfirmation.heading']).toBe('Bestellung bestätigt');
    // No DE source for order shipped — falls back to English
    expect(de['orderShipped.heading']).toBe('Your order has shipped');
  });

  it('falls back entirely to en when locale file is missing', () => {
    const messages = loadEmailMessages('ja');
    expect(messages['orderConfirmation.subject']).toBe(
      'Your order confirmation'
    );
  });

  it('interpolates {param} placeholders via emailT', () => {
    const t = emailT('en');
    expect(t('orderConfirmation.subheading', { name: 'Alex' })).toBe(
      'Thanks for your order, Alex!'
    );
    expect(t('customerWelcome.heading', { shopName: 'Acme' })).toBe(
      'Welcome to Acme'
    );
  });

  it('uses German interpolations when available', () => {
    const t = emailT('de');
    expect(t('passwordResetCustomer.subheading', { name: 'Alex' })).toBe(
      'Hallo Alex, wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.'
    );
  });

  it('returns the key when missing from all catalogs', () => {
    const t = emailT('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
