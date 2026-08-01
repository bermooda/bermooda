import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * Email template for verifying email address and welcoming new users
 *
 * @param {Object} props - Component props
 * @param {string} [props.locale] - Email locale
 * @param {string} props.name - Recipient's name
 * @param {string} props.verificationUrl - URL for email verification
 */
export default function VerifyEmailTemplate({
  locale = 'en',
  name = 'there',
  verificationUrl,
}) {
  const t = emailT(locale);

  return (
    <EmailLayout
      preview={t('authVerify.preview', { platformName: PLATFORM_NAME })}
    >
      <EmailHeading>
        {t('authVerify.heading', { platformName: PLATFORM_NAME })}
      </EmailHeading>
      <EmailSubheading>{t('authVerify.subheading', { name })}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          {t('authVerify.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={verificationUrl}>{t('authVerify.cta')}</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          {t('authVerify.expire')}
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          {t('authVerify.afterVerify')}
        </Text>
        <ul className="dark-mode-text list-disc pl-6 text-base text-slate-700">
          <li className="mb-2">{t('authVerify.listProfile')}</li>
          <li className="mb-2">{t('authVerify.listDashboard')}</li>
          <li className="mb-2">{t('authVerify.listBuild')}</li>
        </ul>
      </Section>
      <EmailFooterLink url={verificationUrl} />
    </EmailLayout>
  );
}
