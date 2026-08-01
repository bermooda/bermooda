import { Section, Text } from '@react-email/components';

import config, { PLATFORM_NAME } from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name
 * @param {string} [props.accountUrl]
 * @param {string} [props.shopName]
 */
export default function CustomerWelcomeEmail({
  locale = 'en',
  name = 'there',
  accountUrl,
  shopName = PLATFORM_NAME,
}) {
  const t = emailT(locale);
  const url = accountUrl ?? `${config.baseUrl}/account`;

  return (
    <EmailLayout
      preview={t('customerWelcome.preview', { shopName, name })}
      brandName={shopName}
    >
      <EmailHeading>{t('customerWelcome.heading', { shopName })}</EmailHeading>
      <EmailSubheading>
        {t('customerWelcome.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t('customerWelcome.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={url}>{t('customerWelcome.cta')}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
