import { Section, Text } from '@react-email/components';

import config from '#/libs/config';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    heading: 'Return received',
    subheading: (orderNumber) =>
      `We have received your return for order ${orderNumber}.`,
    body: 'Your return is being processed. We will notify you once your refund or store credit is issued.',
  },
};

export default function ReturnReceivedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  brandName,
}) {
  const t = labels[locale] ?? labels.en;
  const url = orderUrl ?? `${config.baseUrl}/account/orders`;

  return (
    <EmailLayout
      brandName={brandName}
      preview={`${t.heading} — ${orderNumber}`}
    >
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(orderNumber)}</EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-sm text-slate-700">{t.body}</Text>
      </Section>

      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
