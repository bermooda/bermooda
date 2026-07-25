import { Column, Row, Section, Text } from '@react-email/components';

import config from '#bermooda.config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    subject: 'Your order confirmation',
    heading: 'Order Confirmed',
    subheading: (name) => `Thanks for your order, ${name}!`,
    orderNumber: 'Order number',
    items: 'Items',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    tax: 'Tax',
    discount: 'Discount',
    total: 'Total',
    cta: 'View Order',
  },
  de: {
    subject: 'Ihre Bestellbestätigung',
    heading: 'Bestellung bestätigt',
    subheading: (name) => `Danke für Ihre Bestellung, ${name}!`,
    orderNumber: 'Bestellnummer',
    items: 'Artikel',
    subtotal: 'Zwischensumme',
    shipping: 'Versand',
    tax: 'Steuern',
    discount: 'Rabatt',
    total: 'Gesamt',
    cta: 'Bestellung ansehen',
  },
  fr: {
    subject: 'Confirmation de votre commande',
    heading: 'Commande confirmée',
    subheading: (name) => `Merci pour votre commande, ${name}!`,
    orderNumber: 'Numéro de commande',
    items: 'Articles',
    subtotal: 'Sous-total',
    shipping: 'Livraison',
    tax: 'Taxes',
    discount: 'Réduction',
    total: 'Total',
    cta: 'Voir la commande',
  },
};

function fmt(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name - Customer name
 * @param {string} props.orderNumber
 * @param {string} props.orderUrl
 * @param {Array<{title: string, quantity: number, priceCents: number, totalCents: number}>} props.lines
 * @param {number} props.subtotalCents
 * @param {number} props.shippingCents
 * @param {number} props.taxCents
 * @param {number} props.discountCents
 * @param {number} props.totalCents
 * @param {string} props.currency
 */
export default function OrderConfirmationEmail({
  locale = 'en',
  name = 'there',
  orderNumber,
  orderUrl,
  lines = [],
  subtotalCents = 0,
  shippingCents = 0,
  taxCents = 0,
  discountCents = 0,
  totalCents = 0,
  currency = 'USD',
}) {
  const t = labels[locale] ?? labels.en;
  const url = orderUrl ?? `${config.baseUrl}/account/orders`;

  return (
    <EmailLayout preview={`${t.heading} — ${orderNumber}`}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(name)}</EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-sm text-slate-500">
          {t.orderNumber}:{' '}
          <strong className="text-slate-800">{orderNumber}</strong>
        </Text>

        {lines.map((line, i) => (
          <Row key={i} className="border-b border-slate-200 py-2">
            <Column className="dark-mode-text flex-1 text-sm text-slate-700">
              {line.title} × {line.quantity}
            </Column>
            <Column className="dark-mode-text text-right text-sm text-slate-700">
              {fmt(line.totalCents, currency)}
            </Column>
          </Row>
        ))}

        <Row className="pt-2">
          <Column className="dark-mode-text text-sm text-slate-500">
            {t.subtotal}
          </Column>
          <Column className="dark-mode-text text-right text-sm text-slate-700">
            {fmt(subtotalCents, currency)}
          </Column>
        </Row>
        {shippingCents > 0 && (
          <Row>
            <Column className="dark-mode-text text-sm text-slate-500">
              {t.shipping}
            </Column>
            <Column className="dark-mode-text text-right text-sm text-slate-700">
              {fmt(shippingCents, currency)}
            </Column>
          </Row>
        )}
        {taxCents > 0 && (
          <Row>
            <Column className="dark-mode-text text-sm text-slate-500">
              {t.tax}
            </Column>
            <Column className="dark-mode-text text-right text-sm text-slate-700">
              {fmt(taxCents, currency)}
            </Column>
          </Row>
        )}
        {discountCents > 0 && (
          <Row>
            <Column className="dark-mode-text text-sm text-slate-500">
              {t.discount}
            </Column>
            <Column className="dark-mode-text text-right text-sm text-green-600">
              -{fmt(discountCents, currency)}
            </Column>
          </Row>
        )}
        <Row className="border-t border-slate-200 pt-2">
          <Column className="dark-mode-text font-semibold text-slate-800">
            {t.total}
          </Column>
          <Column className="dark-mode-text text-right font-semibold text-slate-800">
            {fmt(totalCents, currency)}
          </Column>
        </Row>
      </Section>

      <Section className="my-4 text-center">
        <EmailButton url={url}>{t.cta}</EmailButton>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
