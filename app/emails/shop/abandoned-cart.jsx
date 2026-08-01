import { Column, Row, Section, Text } from '@react-email/components';

import config from '#/libs/config';
import { cartLineTotal } from '#/core/cart/lines';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    preview: 'You left something behind',
    heading: 'You left something in your cart',
    subheading: (name) => `Hey ${name}, still thinking it over?`,
    body: "Your cart is saved and ready when you are. Don't let these items sell out!",
    items: 'Items in your cart',
    cta: 'Complete Your Purchase',
  },
  de: {
    preview: 'Sie haben etwas vergessen',
    heading: 'Sie haben etwas in Ihrem Warenkorb',
    subheading: (name) => `Hallo ${name}, denken Sie noch darüber nach?`,
    body: 'Ihr Warenkorb ist gespeichert und wartet auf Sie. Lassen Sie diese Artikel nicht ausverkaufen!',
    items: 'Artikel in Ihrem Warenkorb',
    cta: 'Kauf abschließen',
  },
  fr: {
    preview: 'Vous avez oublié quelque chose',
    heading: 'Vous avez laissé quelque chose dans votre panier',
    subheading: (name) => `Hé ${name}, vous hésitez encore?`,
    body: "Votre panier est sauvegardé et prêt quand vous l'êtes. Ne laissez pas ces articles se vendre!",
    items: 'Articles dans votre panier',
    cta: 'Finaliser votre achat',
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
 * @param {string} [props.brandName]
 * @param {string} props.name
 * @param {string} [props.cartUrl]
 * @param {Array<{title: string, quantity: number, priceCentsSnapshot: number}>} [props.lines]
 * @param {string} [props.currency]
 */
export default function AbandonedCartEmail({
  locale = 'en',
  name = 'there',
  cartUrl,
  lines = [],
  currency = 'USD',
  brandName,
}) {
  const t = labels[locale] ?? labels.en;
  const url = cartUrl ?? `${config.baseUrl}/cart`;

  return (
    <EmailLayout brandName={brandName} preview={t.preview}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(name)}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text mb-2 text-base text-slate-700">
          {t.body}
        </Text>

        {lines.length > 0 && (
          <>
            <Text className="dark-mode-text mb-1 text-sm font-semibold text-slate-600">
              {t.items}
            </Text>
            {lines.map((line, i) => (
              <Row key={i} className="border-b border-slate-200 py-1">
                <Column className="dark-mode-text flex-1 text-sm text-slate-700">
                  {line.title} × {line.quantity}
                </Column>
                <Column className="dark-mode-text text-right text-sm text-slate-700">
                  {fmt(cartLineTotal(line), currency)}
                </Column>
              </Row>
            ))}
          </>
        )}

        <Section className="mt-4 text-center">
          <EmailButton url={url}>{t.cta}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
