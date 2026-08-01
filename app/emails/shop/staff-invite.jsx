import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    preview: `You've been invited to ${PLATFORM_NAME} admin`,
    heading: `Join the ${PLATFORM_NAME} admin team`,
    subheading: (name) =>
      `Hi ${name}, you've been invited to access the ${PLATFORM_NAME} admin back office.`,
    body: 'Click the button below to create your password and activate your account. This link expires in 1 hour.',
    warning:
      "If you weren't expecting this invitation, you can safely ignore this email.",
    cta: 'Create admin password',
  },
  de: {
    preview: `Sie wurden zum ${PLATFORM_NAME}-Admin eingeladen`,
    heading: `Willkommen im ${PLATFORM_NAME}-Admin`,
    subheading: (name) =>
      `Hallo ${name}, Sie wurden eingeladen, auf das ${PLATFORM_NAME}-Admin-Backend zuzugreifen.`,
    body: 'Klicken Sie auf die Schaltfläche unten, um Ihr Passwort zu erstellen und Ihr Konto zu aktivieren. Dieser Link läuft in 1 Stunde ab.',
    warning:
      'Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.',
    cta: 'Admin-Passwort erstellen',
  },
};

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name
 * @param {string} props.inviteUrl
 */
export default function StaffInviteEmail({
  locale = 'en',
  name = 'there',
  inviteUrl,
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
          <EmailButton url={inviteUrl}>{t.cta}</EmailButton>
        </Section>
        <Text className="dark-mode-text text-sm text-slate-500">
          {t.warning}
        </Text>
      </Section>
      <EmailFooterLink url={inviteUrl} />
    </EmailLayout>
  );
}
