import { Section, Text } from '@react-email/components';

import config from '#/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    preview: `Reset your ${config.appName} admin password`,
    heading: 'Reset Your Admin Password',
    subheading: (name) =>
      `Hi ${name}, we received a request to reset your admin password.`,
    body: 'Click the button below to reset your password. This link expires in 1 hour.',
    warning:
      "If you didn't request this, please ignore this email or contact support immediately.",
    cta: 'Reset Admin Password',
  },
  de: {
    preview: `Ihr ${config.appName}-Admin-Passwort zurücksetzen`,
    heading: 'Admin-Passwort zurücksetzen',
    subheading: (name) =>
      `Hallo ${name}, wir haben eine Anfrage zum Zurücksetzen Ihres Admin-Passworts erhalten.`,
    body: 'Klicken Sie auf die Schaltfläche unten, um Ihr Passwort zurückzusetzen. Dieser Link läuft in 1 Stunde ab.',
    warning:
      'Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail oder kontaktieren Sie sofort den Support.',
    cta: 'Admin-Passwort zurücksetzen',
  },
};

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
  const t = labels[locale] ?? labels.en;

  return (
    <EmailLayout preview={t.preview}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(name)}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t.body}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={resetUrl}>{t.cta}</EmailButton>
        </Section>
        <Text className="dark-mode-text text-sm text-slate-500">
          {t.warning}
        </Text>
      </Section>
      <EmailFooterLink url={resetUrl} />
    </EmailLayout>
  );
}
