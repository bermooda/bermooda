import { Section, Text } from '@react-email/components';

import config from '#bermooda.config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    heading: 'Your order has shipped',
    subheading: (orderNumber) => `Order ${orderNumber} is on its way.`,
    carrier: 'Carrier',
    tracking: 'Tracking number',
    cta: 'Track Order',
  },
};

export default function OrderShippedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  carrier,
  trackingNumber,
  trackingUrl,
}) {
  const t = labels[locale] ?? labels.en;
  const url = trackingUrl ?? orderUrl ?? `${config.baseUrl}/account/orders`;

  return (
    <EmailLayout preview={`${t.heading} — ${orderNumber}`}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(orderNumber)}</EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        {carrier && (
          <Text className="dark-mode-text text-sm text-slate-700">
            {t.carrier}: <strong>{carrier}</strong>
          </Text>
        )}
        {trackingNumber && (
          <Text className="dark-mode-text text-sm text-slate-700">
            {t.tracking}: <strong>{trackingNumber}</strong>
          </Text>
        )}
      </Section>

      <Section className="my-4 text-center">
        <EmailButton url={url}>{t.cta}</EmailButton>
      </Section>
      <EmailFooterLink url={orderUrl ?? `${config.baseUrl}/account/orders`} />
    </EmailLayout>
  );
}
