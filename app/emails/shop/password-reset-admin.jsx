import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
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
 * @param {string} props.resetUrl
 */
export default function PasswordResetAdminEmail({
  locale = 'en',
  name = 'there',
  resetUrl,
}) {
  const t = emailT(locale);
  const platformName = PLATFORM_NAME;

  return (
    <EmailLayout preview={t('passwordResetAdmin.preview', { platformName })}>
      <EmailHeading>{t('passwordResetAdmin.heading')}</EmailHeading>
      <EmailSubheading>
        {t('passwordResetAdmin.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t('passwordResetAdmin.body')}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={resetUrl}>
            {t('passwordResetAdmin.cta')}
          </EmailButton>
        </Section>
        <Text className="dark-mode-text text-sm text-slate-500">
          {t('passwordResetAdmin.warning')}
        </Text>
      </Section>
      <EmailFooterLink url={resetUrl} />
    </EmailLayout>
  );
}
