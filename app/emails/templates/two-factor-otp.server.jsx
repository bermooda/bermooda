import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * Email template for sending two-factor authentication OTP code
 *
 * @param {Object} props - Component props
 * @param {string} [props.locale] - Email locale
 * @param {string} props.name - Recipient's name
 * @param {string} props.otp - The 6-digit OTP code
 */
export default function TwoFactorOtpTemplate({
  locale = 'en',
  name = 'there',
  otp,
}) {
  const t = emailT(locale);

  return (
    <EmailLayout
      preview={t('authTwoFactor.preview', {
        platformName: PLATFORM_NAME,
        otp,
      })}
    >
      <EmailHeading>{t('authTwoFactor.heading')}</EmailHeading>
      <EmailSubheading>
        {t('authTwoFactor.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          {t('authTwoFactor.body', { platformName: PLATFORM_NAME })}
        </Text>
        <Section className="text-center">
          <Text className="dark-mode dark-text-cyan-400 m-0 rounded-lg bg-white px-4 py-6 font-mono text-4xl font-bold tracking-widest text-cyan-600">
            {otp}
          </Text>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          {t('authTwoFactor.expire')}
        </Text>
        <Section className="dark-mode-bg my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="dark-mode-text m-0 text-sm font-semibold text-amber-800">
            {t('authTwoFactor.securityTitle')}
          </Text>
          <Text className="dark-mode-text m-0 mt-2 text-sm text-amber-700">
            {t('authTwoFactor.securityBody', { platformName: PLATFORM_NAME })}
          </Text>
        </Section>
      </Section>
    </EmailLayout>
  );
}
