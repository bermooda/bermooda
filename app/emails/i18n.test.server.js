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

  it('overlays locale strings for translated keys', () => {
    const de = loadEmailMessages('de');
    expect(de['orderConfirmation.heading']).toBe('Bestellung bestätigt');
    expect(de['orderShipped.heading']).toBe('Ihre Bestellung wurde versendet');
  });

  it('overlays locale strings for previously English-fallback keys', () => {
    const de = loadEmailMessages('de');
    expect(de['orderShipped.heading']).not.toBe('Your order has shipped');
    expect(de['orderShipped.heading']).toBeTruthy();

    const fr = loadEmailMessages('fr');
    expect(fr['orderShipped.heading']).not.toBe('Your order has shipped');
    expect(fr['passwordResetAdmin.subject']).not.toBe(
      'Reset your admin password'
    );
    expect(fr['staffInvite.cta']).not.toBe('Create admin password');
  });

  it('has key parity with English catalog after overlay', () => {
    const en = loadEmailMessages('en');
    const de = loadEmailMessages('de');
    const fr = loadEmailMessages('fr');
    const enKeys = Object.keys(en);

    for (const key of enKeys) {
      expect(de).toHaveProperty(key);
      expect(fr).toHaveProperty(key);
    }
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

  it('loads auth template keys in supported catalogs', () => {
    const en = emailT('en');
    expect(en('authWelcome.subject', { platformName: 'bermooda' })).toBe(
      'Welcome to bermooda'
    );
    expect(en('authVerify.cta')).toBe('Verify Email Address');
    expect(en('authResetPassword.expire')).toContain('1 hour');
    expect(
      en('authTwoFactor.preview', { platformName: 'bermooda', otp: 123456 })
    ).toBe('Your bermooda verification code: 123456');

    const de = emailT('de');
    expect(de('authWelcome.cta')).toBe('Loslegen');
    expect(de('authVerify.subject')).toBe(
      'Bitte bestätigen Sie Ihre E-Mail-Adresse'
    );
    expect(de('authResetPassword.cta')).toBe('Passwort zurücksetzen');
    expect(de('authTwoFactor.securityTitle')).toContain('Sicherheit');

    const fr = emailT('fr');
    expect(fr('authWelcome.cta')).toBe('Commencer');
    expect(fr('authVerify.subject')).toBe(
      'Veuillez vérifier votre adresse e-mail'
    );
    expect(fr('authResetPassword.cta')).toBe('Réinitialiser le mot de passe');
    expect(fr('authTwoFactor.securityTitle')).toContain('sécurité');
  });

  it('returns the key when missing from all catalogs', () => {
    const t = emailT('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
