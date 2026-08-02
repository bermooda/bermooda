import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

/**
 * Welcome email component
 *
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.name]
 * @param {string} props.getStartedUrl
 */
export default function WelcomeEmail({
  locale = 'en',
  name = 'there',
  getStartedUrl,
}) {
  const t = emailT(locale);
  const platformName = PLATFORM_NAME;

  return (
    <EmailLayout preview={t('authWelcome.preview', { name })}>
      <EmailHeading>{t('authWelcome.heading', { platformName })}</EmailHeading>
      <EmailSubheading>{t('authWelcome.subheading', { name })}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text text-base text-slate-700">
          {t('authWelcome.body')}
        </Text>
        <ul className="dark-mode-text list-disc pl-6 text-base text-slate-700">
          <li className="mb-2">{t('authWelcome.list.profile')}</li>
          <li className="mb-2">{t('authWelcome.list.dashboard')}</li>
          <li className="mb-2">{t('authWelcome.list.build')}</li>
        </ul>
      </Section>
      <Section className="my-4 text-center">
        <EmailButton url={getStartedUrl}>{t('authWelcome.cta')}</EmailButton>
      </Section>
      <EmailFooterLink url={getStartedUrl} />
    </EmailLayout>
  );
}
