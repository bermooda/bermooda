import { Section, Text } from '@react-email/components';

import config from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import { emailT } from '#/emails/i18n.server';

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.brandName]
 * @param {{ sku?: string|null }} [props.variant]
 */
export default function BackInStockEmail({
  locale = 'en',
  brandName,
  variant,
}) {
  const t = emailT(locale);
  const sku = variant?.sku ?? 'this item';
  const shopUrl = `${config.baseUrl}/search?q=${encodeURIComponent(sku)}`;

  return (
    <EmailLayout
      brandName={brandName}
      preview={t('backInStock.preview', { sku })}
    >
      <EmailHeading>{t('backInStock.heading')}</EmailHeading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t('backInStock.body', { sku })}
        </Text>
        <Section className="mt-4 text-center">
          <EmailButton url={shopUrl}>{t('backInStock.cta')}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={shopUrl} />
    </EmailLayout>
  );
}
