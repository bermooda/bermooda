import { Section, Text } from '@react-email/components';

import config from '#/libs/config';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.brandName]
 * @param {string} props.orderNumber
 * @param {string} [props.orderUrl]
 */
export default function ReturnReceivedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  brandName,
}) {
  const t = emailT(locale);
  const url = orderUrl ?? `${config.baseUrl}/account/orders`;
  const heading = t('returnReceived.heading');

  return (
    <EmailLayout brandName={brandName} preview={`${heading} — ${orderNumber}`}>
      <EmailHeading>{heading}</EmailHeading>
      <EmailSubheading>
        {t('returnReceived.subheading', { orderNumber })}
      </EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-sm text-slate-700">
          {t('returnReceived.body')}
        </Text>
      </Section>

      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
