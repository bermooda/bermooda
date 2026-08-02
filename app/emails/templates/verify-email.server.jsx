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
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.name]
 * @param {string} props.verificationUrl
 */
export default function VerifyEmailTemplate({
  locale = 'en',
  name = 'there',
  verificationUrl,
}) {
  const t = emailT(locale);
  const platformName = PLATFORM_NAME;

  return (
    <EmailLayout preview={t('authVerify.preview', { platformName })}>
      <EmailHeading>{t('authVerify.heading', { platformName })}</EmailHeading>
      <EmailSubheading>{t('authVerify.subheading', { name })}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          {t('authVerify.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={verificationUrl}>{t('authVerify.cta')}</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          {t('authVerify.expiry')}
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          {t('authVerify.after')}
        </Text>
        <ul className="dark-mode-text list-disc pl-6 text-base text-slate-700">
          <li className="mb-2">{t('authVerify.list.profile')}</li>
          <li className="mb-2">{t('authVerify.list.dashboard')}</li>
          <li className="mb-2">{t('authVerify.list.build')}</li>
        </ul>
      </Section>
      <EmailFooterLink url={verificationUrl} />
    </EmailLayout>
  );
}
