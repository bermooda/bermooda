import { Section, Text } from '@react-email/components';

import config from '#/libs/config';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

function fmt(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.brandName]
 * @param {string} props.orderNumber
 * @param {string} [props.orderUrl]
 * @param {number} [props.amountCents]
 * @param {string} [props.currency]
 */
export default function OrderRefundedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  amountCents = 0,
  currency = 'USD',
  brandName,
}) {
  const t = emailT(locale);
  const url = orderUrl ?? `${config.baseUrl}/account/orders`;
  const heading = t('orderRefunded.heading');

  return (
    <EmailLayout brandName={brandName} preview={`${heading} — ${orderNumber}`}>
      <EmailHeading>{heading}</EmailHeading>
      <EmailSubheading>
        {t('orderRefunded.subheading', { orderNumber })}
      </EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-sm text-slate-700">
          {t('orderRefunded.amount')}:{' '}
          <strong>{fmt(amountCents, currency)}</strong>
        </Text>
      </Section>

      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
