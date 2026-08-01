import { Section, Text } from '@react-email/components';

import config from '#/libs/config';
import EmailButton from '#/emails/components/button';
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
 * @param {string} [props.carrier]
 * @param {string} [props.trackingNumber]
 * @param {string} [props.trackingUrl]
 */
export default function OrderShippedEmail({
  locale = 'en',
  orderNumber,
  orderUrl,
  carrier,
  trackingNumber,
  trackingUrl,
  brandName,
}) {
  const t = emailT(locale);
  const url = trackingUrl ?? orderUrl ?? `${config.baseUrl}/account/orders`;
  const heading = t('orderShipped.heading');

  return (
    <EmailLayout brandName={brandName} preview={`${heading} — ${orderNumber}`}>
      <EmailHeading>{heading}</EmailHeading>
      <EmailSubheading>
        {t('orderShipped.subheading', { orderNumber })}
      </EmailSubheading>

      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        {carrier && (
          <Text className="dark-mode-text text-sm text-slate-700">
            {t('orderShipped.carrier')}: <strong>{carrier}</strong>
          </Text>
        )}
        {trackingNumber && (
          <Text className="dark-mode-text text-sm text-slate-700">
            {t('orderShipped.tracking')}: <strong>{trackingNumber}</strong>
          </Text>
        )}
      </Section>

      <Section className="my-4 text-center">
        <EmailButton url={url}>{t('orderShipped.cta')}</EmailButton>
      </Section>
      <EmailFooterLink url={orderUrl ?? `${config.baseUrl}/account/orders`} />
    </EmailLayout>
  );
}
