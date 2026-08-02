import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * Email template for resetting password
 *
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.name]
 * @param {string} props.resetUrl
 */
export default function ResetPasswordTemplate({
  locale = 'en',
  name = 'there',
  resetUrl,
}) {
  const t = emailT(locale);
  const platformName = PLATFORM_NAME;

  return (
    <EmailLayout preview={t('authResetPassword.preview', { platformName })}>
      <EmailHeading>{t('authResetPassword.heading')}</EmailHeading>
      <EmailSubheading>
        {t('authResetPassword.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          {t('authResetPassword.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={resetUrl}>{t('authResetPassword.cta')}</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          {t('authResetPassword.expiry')}
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          {t('authResetPassword.ignore')}
        </Text>
      </Section>
      <EmailFooterLink url={resetUrl} />
    </EmailLayout>
  );
}
