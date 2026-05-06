import { Section, Text } from '@react-email/components';

import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    preview: 'Reset your password',
    heading: 'Reset Your Password',
    subheading: (name) =>
      `Hi ${name}, we received a request to reset your password.`,
    body: 'Click the button below to reset your password. This link expires in 1 hour.',
    warning: "If you didn't request this, you can safely ignore this email.",
    cta: 'Reset Password',
  },
  de: {
    preview: 'Ihr Passwort zurücksetzen',
    heading: 'Passwort zurücksetzen',
    subheading: (name) =>
      `Hallo ${name}, wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.`,
    body: 'Klicken Sie auf die Schaltfläche unten, um Ihr Passwort zurückzusetzen. Dieser Link läuft in 1 Stunde ab.',
    warning:
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
    cta: 'Passwort zurücksetzen',
  },
  fr: {
    preview: 'Réinitialisez votre mot de passe',
    heading: 'Réinitialisez votre mot de passe',
    subheading: (name) =>
      `Bonjour ${name}, nous avons reçu une demande de réinitialisation de votre mot de passe.`,
    body: 'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe. Ce lien expire dans 1 heure.',
    warning: "Si vous n'avez pas fait cette demande, ignorez cet e-mail.",
    cta: 'Réinitialiser le mot de passe',
  },
};

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name
 * @param {string} props.resetUrl
 */
export default function PasswordResetCustomerEmail({
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
