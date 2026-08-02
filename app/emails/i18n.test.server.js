// app/emails/i18n.test.server.js
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearEmailMessagesCache,
  emailT,
  loadEmailMessages,
} from '#/emails/i18n.server';
import deCatalog from '#/emails/i18n/de.json';
import enCatalog from '#/emails/i18n/en.json';
import frCatalog from '#/emails/i18n/fr.json';

describe('email i18n catalogs', () => {
  beforeEach(() => {
    clearEmailMessagesCache();
  });

  it('loads flat English keys', () => {
    const messages = loadEmailMessages('en');
    expect(messages['orderConfirmation.heading']).toBe('Order Confirmed');
    expect(messages['abandonedCart.cta']).toBe('Complete Your Purchase');
  });

  it('overlays German strings for previously English-fallback keys', () => {
    const de = loadEmailMessages('de');
    expect(de['orderConfirmation.heading']).toBe('Bestellung bestätigt');
    expect(de['orderShipped.heading']).toBe('Ihre Bestellung wurde versendet');
    expect(de['orderDelivered.subject']).toBe(
      'Ihre Bestellung wurde zugestellt'
    );
    expect(de['orderRefunded.amount']).toBe('Rückerstattungsbetrag');
    expect(de['returnReceived.heading']).toBe('Rücksendung erhalten');
    expect(de['backInStock.cta']).toBe('Jetzt einkaufen');
  });

  it('overlays French strings including admin reset and invite', () => {
    const fr = loadEmailMessages('fr');
    expect(fr['orderConfirmation.heading']).toBe('Commande confirmée');
    expect(fr['orderShipped.heading']).toBe('Votre commande a été expédiée');
    expect(fr['orderDelivered.cta']).toBe('Voir la commande');
    expect(fr['orderRefunded.heading']).toBe('Remboursement traité');
    expect(fr['returnReceived.subject']).toBe('Retour reçu');
    expect(fr['backInStock.heading']).toBe('De nouveau en stock');
    expect(fr['passwordResetAdmin.cta']).toBe(
      'Réinitialiser le mot de passe admin'
    );
    expect(fr['staffInvite.heading']).toBe(
      "Rejoignez l'équipe admin de {platformName}"
    );
  });

  it('covers every English key in de and fr overlay files', () => {
    const enKeys = Object.keys(enCatalog).sort();
    expect(enKeys).toHaveLength(105);
    expect(Object.keys(deCatalog).sort()).toEqual(enKeys);
    expect(Object.keys(frCatalog).sort()).toEqual(enKeys);
  });

  const AUTH_KEYS = [
    'authWelcome.subject',
    'authWelcome.preview',
    'authWelcome.heading',
    'authWelcome.subheading',
    'authWelcome.body',
    'authWelcome.list.profile',
    'authWelcome.list.dashboard',
    'authWelcome.list.build',
    'authWelcome.cta',
    'authVerify.subject',
    'authVerify.preview',
    'authVerify.heading',
    'authVerify.subheading',
    'authVerify.body',
    'authVerify.cta',
    'authVerify.expiry',
    'authVerify.after',
    'authVerify.list.profile',
    'authVerify.list.dashboard',
    'authVerify.list.build',
    'authResetPassword.subject',
    'authResetPassword.preview',
    'authResetPassword.heading',
    'authResetPassword.subheading',
    'authResetPassword.body',
    'authResetPassword.cta',
    'authResetPassword.expiry',
    'authResetPassword.ignore',
    'authTwoFactor.subject',
    'authTwoFactor.preview',
    'authTwoFactor.heading',
    'authTwoFactor.subheading',
    'authTwoFactor.body',
    'authTwoFactor.expiry',
    'authTwoFactor.securityTitle',
    'authTwoFactor.securityBody',
  ];

  it('includes auth template keys in en/de/fr catalogs', () => {
    for (const key of AUTH_KEYS) {
      expect(enCatalog[key], `en missing ${key}`).toEqual(expect.any(String));
      expect(deCatalog[key], `de missing ${key}`).toEqual(expect.any(String));
      expect(frCatalog[key], `fr missing ${key}`).toEqual(expect.any(String));
      expect(enCatalog[key].length).toBeGreaterThan(0);
      expect(deCatalog[key]).not.toBe(enCatalog[key]);
      expect(frCatalog[key]).not.toBe(enCatalog[key]);
    }
  });

  it('returns German auth subjects via emailT', () => {
    const t = emailT('de');
    expect(t('authWelcome.subject', { platformName: 'bermooda' })).toMatch(
      /Willkommen/
    );
    expect(t('authVerify.subject')).not.toBe(enCatalog['authVerify.subject']);
    expect(t('authResetPassword.subject')).not.toBe(
      enCatalog['authResetPassword.subject']
    );
    expect(t('authTwoFactor.subject')).not.toBe(
      enCatalog['authTwoFactor.subject']
    );
  });

  it('returns French auth subjects via emailT', () => {
    const t = emailT('fr');
    expect(t('authWelcome.subject', { platformName: 'bermooda' })).toMatch(
      /Bienvenue/
    );
    expect(t('authVerify.cta')).not.toBe(enCatalog['authVerify.cta']);
    expect(t('authResetPassword.cta')).not.toBe(
      enCatalog['authResetPassword.cta']
    );
    expect(t('authTwoFactor.heading')).not.toBe(
      enCatalog['authTwoFactor.heading']
    );
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
    expect(t('orderShipped.subheading', { orderNumber: '1001' })).toBe(
      'Bestellung 1001 ist unterwegs.'
    );
  });

  it('uses French interpolations when available', () => {
    const t = emailT('fr');
    expect(
      t('staffInvite.subheading', { name: 'Alex', platformName: 'Acme' })
    ).toBe(
      'Bonjour Alex, vous avez été invité(e) à accéder au back-office admin de Acme.'
    );
    expect(t('backInStock.preview', { sku: 'SKU-1' })).toBe(
      'SKU-1 est de nouveau en stock'
    );
  });

  it('returns the key when missing from all catalogs', () => {
    const t = emailT('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
