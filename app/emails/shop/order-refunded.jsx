import { Section, Text } from '@react-email/components';

import config from '#/core/config';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

function fmt(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

const labels = {
  en: {
    heading: 'Refund processed',
    subheading: (orderNumber) =>
      `A refund has been issued for order ${orderNumber}.`,
    amount: 'Refund amount',
  },
};

export default function OrderRefundedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  amountCents = 0,
  currency = 'USD',
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
        <Text className="dark-mode-text text-sm text-slate-700">
          {t.amount}: <strong>{fmt(amountCents, currency)}</strong>
        </Text>
      </Section>

      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
