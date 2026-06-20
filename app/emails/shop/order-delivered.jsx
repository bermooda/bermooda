import { Section, Text } from '@react-email/components';

import config from '#/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    heading: 'Your order was delivered',
    subheading: (orderNumber) => `Order ${orderNumber} has been delivered.`,
    cta: 'View Order',
  },
};

export default function OrderDeliveredEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
}) {
  const t = labels[locale] ?? labels.en;
  const url = orderUrl ?? `${config.baseUrl}/account/orders`;

  return (
    <EmailLayout preview={`${t.heading} — ${orderNumber}`}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(orderNumber)}</EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-green-50 px-6 py-4">
        <Text className="dark-mode-text text-sm text-slate-700">
          We hope you enjoy your purchase!
        </Text>
      </Section>

      <Section className="my-4 text-center">
        <EmailButton url={url}>{t.cta}</EmailButton>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
