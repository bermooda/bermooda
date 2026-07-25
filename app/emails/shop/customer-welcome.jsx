import { Section, Text } from '@react-email/components';

import config from '#bermooda.config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

const labels = {
  en: {
    preview: (name) => `Welcome to ${config.appName}, ${name}!`,
    heading: `Welcome to ${config.appName}`,
    subheading: (name) => `Thanks for creating an account, ${name}!`,
    body: 'You can now browse our store, track your orders, and manage your addresses from your account.',
    cta: 'Go to My Account',
  },
  de: {
    preview: (name) => `Willkommen bei ${config.appName}, ${name}!`,
    heading: `Willkommen bei ${config.appName}`,
    subheading: (name) => `Danke für Ihre Registrierung, ${name}!`,
    body: 'Sie können jetzt unseren Shop durchsuchen, Ihre Bestellungen verfolgen und Ihre Adressen in Ihrem Konto verwalten.',
    cta: 'Zu meinem Konto',
  },
  fr: {
    preview: (name) => `Bienvenue sur ${config.appName}, ${name}!`,
    heading: `Bienvenue sur ${config.appName}`,
    subheading: (name) => `Merci de créer un compte, ${name}!`,
    body: 'Vous pouvez maintenant parcourir notre boutique, suivre vos commandes et gérer vos adresses depuis votre espace client.',
    cta: 'Accéder à mon compte',
  },
};

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name
 * @param {string} [props.accountUrl]
 */
export default function CustomerWelcomeEmail({
  locale = 'en',
  name = 'there',
  accountUrl,
}) {
  const t = labels[locale] ?? labels.en;
  const url = accountUrl ?? `${config.baseUrl}/account`;

  return (
    <EmailLayout preview={t.preview(name)}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(name)}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t.body}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={url}>{t.cta}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
