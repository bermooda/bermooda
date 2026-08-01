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
    expect(de['orderShipped.heading']).toBe(
      'Ihre Bestellung wurde versendet'
    );
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
    expect(fr['orderShipped.heading']).toBe(
      'Votre commande a été expédiée'
    );
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
    expect(enKeys).toHaveLength(69);
    expect(Object.keys(deCatalog).sort()).toEqual(enKeys);
    expect(Object.keys(frCatalog).sort()).toEqual(enKeys);
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
