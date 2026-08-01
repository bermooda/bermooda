import { Section, Text } from '@react-email/components';

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
 * @param {string} props.name
 * @param {string} props.resetUrl
 */
export default function PasswordResetCustomerEmail({
  locale = 'en',
  name = 'there',
  resetUrl,
  brandName,
}) {
  const t = emailT(locale);

  return (
    <EmailLayout
      brandName={brandName}
      preview={t('passwordResetCustomer.preview')}
    >
      <EmailHeading>{t('passwordResetCustomer.heading')}</EmailHeading>
      <EmailSubheading>
        {t('passwordResetCustomer.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t('passwordResetCustomer.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={resetUrl}>
            {t('passwordResetCustomer.cta')}
          </EmailButton>
        </Section>
        <Text className="dark-mode-text text-sm text-slate-500">
          {t('passwordResetCustomer.warning')}
        </Text>
      </Section>
      <EmailFooterLink url={resetUrl} />
    </EmailLayout>
  );
}
